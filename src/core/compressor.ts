// ============================================================================
// CLO — Context Compression Engine
// Loss-minimized semantic compression for reasoning state portability.
// ============================================================================

import type {
    ReasoningState,
    ConversationTurn,
    CompressedSegment,
} from "./types";

/**
 * Configuration for the compression engine.
 */
export interface CompressionConfig {
    /** Max number of recent turns to keep in full fidelity */
    maxRecentTurns: number;
    /** Target token budget for the compressed output */
    targetTokenBudget: number;
    /** Whether to preserve all code blocks verbatim */
    preserveCodeBlocks: boolean;
    /** Whether to preserve all tool call results */
    preserveToolCalls: boolean;
}

const DEFAULT_CONFIG: CompressionConfig = {
    maxRecentTurns: 10,
    targetTokenBudget: 4000,
    preserveCodeBlocks: true,
    preserveToolCalls: true,
};

/**
 * Estimate token count (rough: ~4 chars per token).
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Compress a ReasoningState's history to fit within token budgets.
 *
 * Strategy:
 * 1. Keep the N most recent turns at full fidelity.
 * 2. Group older turns into segments.
 * 3. Summarize each segment, preserving key decisions and invariants.
 * 4. Strip conversational noise while keeping semantic anchors.
 */
export function compressHistory(
    state: ReasoningState,
    config: Partial<CompressionConfig> = {}
): ReasoningState {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const updated = structuredClone(state);
    const allTurns = updated.history.recentTurns;

    if (allTurns.length <= cfg.maxRecentTurns) {
        return updated; // Nothing to compress
    }

    // Split: older turns get compressed, recent turns stay
    const olderTurns = allTurns.slice(0, allTurns.length - cfg.maxRecentTurns);
    const recentTurns = allTurns.slice(allTurns.length - cfg.maxRecentTurns);

    // Group older turns into chunks of ~5
    const CHUNK_SIZE = 5;
    const chunks: ConversationTurn[][] = [];
    for (let i = 0; i < olderTurns.length; i += CHUNK_SIZE) {
        chunks.push(olderTurns.slice(i, i + CHUNK_SIZE));
    }

    // Compress each chunk
    const segments: CompressedSegment[] = [
        ...updated.history.compressedSegments,
    ];
    let segmentIndex = segments.length;

    for (const chunk of chunks) {
        const segment = compressChunk(chunk, segmentIndex, cfg);
        segments.push(segment);
        segmentIndex++;
    }

    updated.history.compressedSegments = segments;
    updated.history.recentTurns = recentTurns;
    updated.meta.updatedAt = Date.now();

    return updated;
}

/**
 * Compress a chunk of conversation turns into a CompressedSegment.
 */
function compressChunk(
    turns: ConversationTurn[],
    index: number,
    config: CompressionConfig
): CompressedSegment {
    const summary = generateSummary(turns, config);
    const keyDecisions = extractKeyDecisions(turns);
    const invariants = extractInvariants(turns);
    const originalContent = turns.map((t) => t.content).join(" ");
    const compressionRatio = estimateTokens(summary) / estimateTokens(originalContent);

    return {
        id: `segment_${index}`,
        turnRange: [0, turns.length - 1],
        summary,
        keyDecisions,
        preservedInvariants: invariants,
        originalTurnCount: turns.length,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
    };
}

/**
 * Generate a summary of a chunk of turns.
 *
 * In production, this would call an LLM for summarization.
 * For now, we use extractive summarization heuristics.
 */
function generateSummary(
    turns: ConversationTurn[],
    config: CompressionConfig
): string {
    const parts: string[] = [];

    for (const turn of turns) {
        const prefix = turn.role === "user" ? "USER" : "ASSISTANT";

        // For user messages, keep the first 200 chars
        if (turn.role === "user") {
            const truncated =
                turn.content.length > 200
                    ? turn.content.slice(0, 200) + "..."
                    : turn.content;
            parts.push(`[${prefix}]: ${truncated}`);
        }

        // For assistant messages, extract structure
        if (turn.role === "assistant") {
            // Keep code blocks if configured
            if (config.preserveCodeBlocks && turn.codeBlocks.length > 0) {
                for (const block of turn.codeBlocks) {
                    const truncatedCode =
                        block.code.length > 500
                            ? block.code.slice(0, 500) + "\n// ... truncated"
                            : block.code;
                    parts.push(
                        `[${prefix} CODE${block.filename ? ` (${block.filename})` : ""}]: \`\`\`${block.language}\n${truncatedCode}\n\`\`\``
                    );
                }
            }

            // Keep tool calls if configured
            if (config.preserveToolCalls && turn.toolCalls.length > 0) {
                for (const call of turn.toolCalls) {
                    parts.push(
                        `[${prefix} TOOL]: Called ${call.name}(${JSON.stringify(call.arguments).slice(0, 100)})`
                    );
                }
            }

            // Extract key sentences (heuristic: first sentence + any sentence with "important", "note", "key")
            const sentences = turn.content.split(/[.!?]\s+/);
            if (sentences.length > 0) {
                parts.push(`[${prefix}]: ${sentences[0].slice(0, 150)}...`);
            }
            const keySentences = sentences.filter((s) =>
                /\b(important|note|key|critical|must|decision|constraint)\b/i.test(s)
            );
            for (const ks of keySentences.slice(0, 3)) {
                parts.push(`[${prefix} KEY]: ${ks.slice(0, 200)}`);
            }
        }
    }

    return parts.join("\n");
}

/**
 * Extract key decisions from turns (heuristic).
 */
function extractKeyDecisions(turns: ConversationTurn[]): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
        /(?:decided|chose|selected|going with|opted for|will use)\s+(.+?)(?:\.|$)/gi,
        /(?:decision|approach|strategy):\s*(.+?)(?:\.|$)/gi,
        /(?:let's|we'll|i'll)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const turn of turns) {
        if (turn.role !== "assistant") continue;
        for (const pattern of decisionPatterns) {
            let match;
            while ((match = pattern.exec(turn.content)) !== null) {
                const decision = match[0].trim().slice(0, 200);
                if (!decisions.includes(decision)) {
                    decisions.push(decision);
                }
            }
        }
    }

    return decisions.slice(0, 10); // Max 10 key decisions per segment  
}

/**
 * Extract invariants — facts that must remain true across transitions.
 */
function extractInvariants(turns: ConversationTurn[]): string[] {
    const invariants: string[] = [];
    const invariantPatterns = [
        /(?:always|must always|never change|keep|maintain|preserve)\s+(.+?)(?:\.|$)/gi,
        /(?:requirement|constraint|invariant):\s*(.+?)(?:\.|$)/gi,
        /(?:do not|don't|cannot|must not)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const turn of turns) {
        for (const pattern of invariantPatterns) {
            let match;
            while ((match = pattern.exec(turn.content)) !== null) {
                const inv = match[0].trim().slice(0, 200);
                if (!invariants.includes(inv)) {
                    invariants.push(inv);
                }
            }
        }
    }

    return invariants.slice(0, 10);
}

// ─── State-to-Prompt Compiler ──────────────────────────────────────────────────

/**
 * Compile a ReasoningState into a context prompt for injection into a new LLM.
 *
 * This is the "prompt compiler" — it creates a structured, token-efficient
 * representation of the full task state.
 */
export function compileStateToPrompt(
    state: ReasoningState,
    tokenBudget = 4000
): string {
    const sections: string[] = [];

    // ── Header ──────────────────────────────────────────────────────────────────
    sections.push(
        `# Task Continuation Context (CLO v${state.schemaVersion})\n` +
        `**Task**: ${state.meta.title}\n` +
        `**Objective**: ${state.meta.objective}\n` +
        `**Total Turns**: ${state.meta.totalTurns} across ${state.meta.platforms.join(", ")}\n` +
        `**Models Used**: ${state.meta.models.join(", ")}\n`
    );

    // ── Active Constraints ──────────────────────────────────────────────────────
    const activeConstraints = state.constraints.filter((c) => c.active);
    if (activeConstraints.length > 0) {
        sections.push(
            `## Active Constraints\n` +
            activeConstraints.map((c) => `- ${c.description}`).join("\n")
        );
    }

    // ── Key Decisions ───────────────────────────────────────────────────────────
    if (state.decisions.length > 0) {
        const recentDecisions = state.decisions.slice(-10);
        sections.push(
            `## Key Decisions\n` +
            recentDecisions
                .map((d) => `- **${d.description}**: ${d.rationale}`)
                .join("\n")
        );
    }

    // ── Active Artifacts ────────────────────────────────────────────────────────
    if (state.artifacts.length > 0) {
        sections.push(
            `## Active Artifacts\n` +
            state.artifacts
                .map(
                    (a) =>
                        `### ${a.name} (v${a.version}, ${a.type})\n\`\`\`${a.language || ""}\n${a.content.slice(0, 500)}\n\`\`\``
                )
                .join("\n\n")
        );
    }

    // ── Open Questions ──────────────────────────────────────────────────────────
    const unresolvedQuestions = state.openQuestions.filter((q) => !q.resolved);
    if (unresolvedQuestions.length > 0) {
        sections.push(
            `## Unresolved Questions\n` +
            unresolvedQuestions.map((q) => `- ${q.question}`).join("\n")
        );
    }

    // ── Next Action ─────────────────────────────────────────────────────────────
    if (state.nextAction) {
        sections.push(`## Next Intended Action\n${state.nextAction}`);
    }

    // ── Compressed History ──────────────────────────────────────────────────────
    if (state.history.compressedSegments.length > 0) {
        sections.push(
            `## Conversation Summary (Compressed)\n` +
            state.history.compressedSegments
                .map(
                    (s) =>
                        `### Segment (${s.originalTurnCount} turns, ${s.compressionRatio}x compression)\n${s.summary}`
                )
                .join("\n\n")
        );
    }

    // ── Recent History ──────────────────────────────────────────────────────────
    if (state.history.recentTurns.length > 0) {
        const recentStr = state.history.recentTurns
            .slice(-5)
            .map((t) => {
                const prefix = t.role === "user" ? "USER" : "ASSISTANT";
                const truncated =
                    t.content.length > 300
                        ? t.content.slice(0, 300) + "..."
                        : t.content;
                return `[${prefix}]: ${truncated}`;
            })
            .join("\n");
        sections.push(`## Recent Conversation\n${recentStr}`);
    }

    // ── Assemble & trim to budget ───────────────────────────────────────────────
    let compiled = sections.join("\n\n---\n\n");
    const tokens = estimateTokens(compiled);

    if (tokens > tokenBudget) {
        // Truncate from the bottom (least important: history)
        const ratio = tokenBudget / tokens;
        compiled = compiled.slice(0, Math.floor(compiled.length * ratio));
        compiled += "\n\n[Context truncated to fit token budget]";
    }

    return compiled;
}
