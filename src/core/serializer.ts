// ============================================================================
// CLO — Reasoning State Serializer
// Builds and maintains the canonical ReasoningState from captured sessions.
// ============================================================================

import type {
    ReasoningState,
    CapturedSession,
    ConversationTurn,
    Decision,
    Constraint,
    Artifact,
    OpenQuestion,
    ProvenanceEntry,
    CodeBlock,
} from "./types";

/**
 * Generate a UUID v4.
 */
function uuid(): string {
    return crypto.randomUUID();
}

/**
 * Create a blank ReasoningState.
 */
export function createEmptyState(title = "Untitled Task"): ReasoningState {
    const now = Date.now();
    return {
        id: uuid(),
        schemaVersion: "0.1.0",
        meta: {
            title,
            objective: "",
            createdAt: now,
            updatedAt: now,
            totalTurns: 0,
            platforms: [],
            models: [],
        },
        constraints: [],
        decisions: [],
        artifacts: [],
        openQuestions: [],
        nextAction: "",
        history: {
            recentTurns: [],
            compressedSegments: [],
        },
        provenance: [],
    };
}

/**
 * Ingest a new conversation turn into an existing ReasoningState.
 *
 * This is the core "serialization" step — it doesn't just append,
 * it also extracts semantic content (constraints, decisions, artifacts).
 */
export function ingestTurn(
    state: ReasoningState,
    turn: ConversationTurn,
    platform: CapturedSession["platform"],
    model?: string
): ReasoningState {
    const updated = structuredClone(state);
    const now = Date.now();

    // ── Append turn to recent history ───────────────────────────────────────────
    updated.history.recentTurns.push(turn);
    updated.meta.totalTurns++;
    updated.meta.updatedAt = now;

    // ── Track platform & model ──────────────────────────────────────────────────
    if (!updated.meta.platforms.includes(platform)) {
        updated.meta.platforms.push(platform);
    }
    if (model && !updated.meta.models.includes(model)) {
        updated.meta.models.push(model);
    }

    // ── Extract code blocks as artifacts ────────────────────────────────────────
    for (const block of turn.codeBlocks) {
        upsertArtifactFromCode(updated, block, turn.id);
    }

    // ── Auto-extract constraints from user messages ─────────────────────────────
    if (turn.role === "user") {
        const extracted = extractConstraintsFromText(turn.content, turn.id);
        for (const c of extracted) {
            if (!updated.constraints.some((e) => e.description === c.description)) {
                updated.constraints.push(c);
            }
        }
    }

    // ── Update provenance ───────────────────────────────────────────────────────
    updateProvenance(updated, platform, model || "unknown", turn.id);

    return updated;
}

/**
 * Extract potential constraints from user text.
 * Uses heuristic keyword matching (production would use NLP).
 */
function extractConstraintsFromText(
    text: string,
    turnId: string
): Constraint[] {
    const constraints: Constraint[] = [];
    const constraintPatterns = [
        /must\s+(.+?)(?:\.|$)/gi,
        /should\s+not\s+(.+?)(?:\.|$)/gi,
        /always\s+(.+?)(?:\.|$)/gi,
        /never\s+(.+?)(?:\.|$)/gi,
        /requirement:\s*(.+?)(?:\.|$)/gi,
        /constraint:\s*(.+?)(?:\.|$)/gi,
        /do\s+not\s+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of constraintPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            constraints.push({
                id: uuid(),
                description: match[0].trim(),
                source: "inferred",
                turnId,
                active: true,
            });
        }
    }

    return constraints;
}

/**
 * Upsert an artifact from a code block.
 * If a file with the same name already exists, bump its version.
 */
function upsertArtifactFromCode(
    state: ReasoningState,
    block: CodeBlock,
    turnId: string
): void {
    const name = block.filename || `snippet_${state.artifacts.length + 1}`;
    const existing = state.artifacts.find((a) => a.name === name);

    if (existing) {
        existing.content = block.code;
        existing.version++;
        existing.lastModifiedTurnId = turnId;
    } else {
        state.artifacts.push({
            id: uuid(),
            name,
            type: block.filename ? "file" : "snippet",
            content: block.code,
            language: block.language,
            lastModifiedTurnId: turnId,
            version: 1,
        });
    }
}

/**
 * Update provenance tracking.
 */
function updateProvenance(
    state: ReasoningState,
    platform: CapturedSession["platform"],
    model: string,
    turnId: string
): void {
    const existing = state.provenance.find(
        (p) => p.platform === platform && p.model === model
    );
    if (existing) {
        existing.turnIds.push(turnId);
        existing.timestamp = Date.now();
    } else {
        state.provenance.push({
            platform,
            model,
            turnIds: [turnId],
            timestamp: Date.now(),
        });
    }
}

/**
 * Manually add a decision to the state.
 */
export function addDecision(
    state: ReasoningState,
    description: string,
    rationale: string,
    turnId: string,
    alternatives?: string[]
): ReasoningState {
    const updated = structuredClone(state);
    updated.decisions.push({
        id: uuid(),
        timestamp: Date.now(),
        description,
        rationale,
        alternatives,
        turnId,
    });
    updated.meta.updatedAt = Date.now();
    return updated;
}

/**
 * Add an open question.
 */
export function addOpenQuestion(
    state: ReasoningState,
    question: string,
    turnId: string
): ReasoningState {
    const updated = structuredClone(state);
    updated.openQuestions.push({
        id: uuid(),
        question,
        turnId,
        resolved: false,
    });
    return updated;
}

/**
 * Resolve an open question.
 */
export function resolveQuestion(
    state: ReasoningState,
    questionId: string,
    resolution: string
): ReasoningState {
    const updated = structuredClone(state);
    const q = updated.openQuestions.find((q) => q.id === questionId);
    if (q) {
        q.resolved = true;
        q.resolution = resolution;
    }
    return updated;
}

/**
 * Set the next intended action.
 */
export function setNextAction(
    state: ReasoningState,
    action: string
): ReasoningState {
    const updated = structuredClone(state);
    updated.nextAction = action;
    updated.meta.updatedAt = Date.now();
    return updated;
}

/**
 * Export a ReasoningState as a portable JSON string.
 */
export function exportState(state: ReasoningState): string {
    return JSON.stringify(state, null, 2);
}

/**
 * Validate and import a ReasoningState from JSON.
 * Ensures all required fields exist and provides sensible defaults for missing fields.
 */
export function importState(json: string): ReasoningState {
    let parsed: any;

    // Try to parse JSON
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Validate schema version
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Imported data must be a valid JSON object");
    }

    if (parsed.schemaVersion !== "0.1.0") {
        throw new Error(`Unsupported schema version: ${parsed.schemaVersion}. Expected 0.1.0`);
    }

    // Validate required top-level fields
    if (!parsed.id || typeof parsed.id !== "string") {
        throw new Error("Missing required field: id");
    }

    if (!parsed.meta || typeof parsed.meta !== "object") {
        throw new Error("Missing required field: meta");
    }

    // Ensure all required arrays exist
    const state: ReasoningState = {
        id: parsed.id,
        schemaVersion: parsed.schemaVersion,
        meta: {
            title: parsed.meta?.title || "Imported Task",
            objective: parsed.meta?.objective || "",
            createdAt: parsed.meta?.createdAt || Date.now(),
            updatedAt: parsed.meta?.updatedAt || Date.now(),
            totalTurns: parsed.meta?.totalTurns || 0,
            platforms: Array.isArray(parsed.meta?.platforms) ? parsed.meta.platforms : [],
            models: Array.isArray(parsed.meta?.models) ? parsed.meta.models : [],
        },
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
        openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
        nextAction: parsed.nextAction || "",
        history: {
            recentTurns: Array.isArray(parsed.history?.recentTurns) ? parsed.history.recentTurns : [],
            compressedSegments: Array.isArray(parsed.history?.compressedSegments) ? parsed.history.compressedSegments : [],
        },
        provenance: Array.isArray(parsed.provenance) ? parsed.provenance : [],
    };

    return state;
}
