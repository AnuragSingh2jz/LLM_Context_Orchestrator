// ============================================================================
// CLO — Core Type Definitions
// The canonical type system for the Cross-LLM Context Orchestrator.
// ============================================================================

/**
 * Supported LLM platforms.
 */
export type LLMPlatform = "chatgpt" | "claude" | "gemini" | "grok" | "unknown";

/**
 * The role of a message participant.
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * Identified model string (e.g. "gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash").
 */
export type ModelIdentifier = string;

// ─── Conversation Primitives ───────────────────────────────────────────────────

/**
 * A single code block extracted from a message.
 */
export interface CodeBlock {
    language: string;
    code: string;
    filename?: string;
}

/**
 * A tool/function call made by the model.
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
}

/**
 * A single turn in a conversation.
 */
export interface ConversationTurn {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    model?: ModelIdentifier;
    codeBlocks: CodeBlock[];
    toolCalls: ToolCall[];
    editedFrom?: string; // ID of the turn this was edited from
    tokens?: {
        prompt?: number;
        completion?: number;
    };
}

// ─── Reasoning State Primitives ────────────────────────────────────────────────

/**
 * A single logged decision made during the reasoning process.
 */
export interface Decision {
    id: string;
    timestamp: number;
    description: string;
    rationale: string;
    alternatives?: string[];
    turnId: string; // which turn triggered this decision
}

/**
 * A constraint that must be preserved across model transitions.
 */
export interface Constraint {
    id: string;
    description: string;
    source: "user" | "inferred";
    turnId: string;
    active: boolean;
}

/**
 * An artifact (file, schema, config, etc.) being tracked.
 */
export interface Artifact {
    id: string;
    name: string;
    type: "file" | "schema" | "config" | "snippet" | "other";
    content: string;
    language?: string;
    lastModifiedTurnId: string;
    version: number;
}

/**
 * An unresolved question or ambiguity.
 */
export interface OpenQuestion {
    id: string;
    question: string;
    turnId: string;
    resolved: boolean;
    resolution?: string;
}

// ─── The Canonical Reasoning State ─────────────────────────────────────────────

/**
 * ReasoningState — The core portable object.
 *
 * This is the "git commit" equivalent for an LLM reasoning session.
 * It contains everything needed to resume a task on any LLM.
 */
export interface ReasoningState {
    /** Unique state ID (UUID v4) */
    id: string;

    /** Schema version for forwards-compatibility */
    schemaVersion: "0.1.0";

    /** High-level task metadata */
    meta: {
        title: string;
        objective: string;
        createdAt: number;
        updatedAt: number;
        totalTurns: number;
        platforms: LLMPlatform[];
        models: ModelIdentifier[];
    };

    /** Active constraints and assumptions */
    constraints: Constraint[];

    /** Decision log — the "git log" of reasoning */
    decisions: Decision[];

    /** Tracked artifacts (files, code, schemas, etc.) */
    artifacts: Artifact[];

    /** Open/unresolved questions */
    openQuestions: OpenQuestion[];

    /** Next intended action — what should happen next */
    nextAction: string;

    /** Compressed conversation history */
    history: {
        /** Full recent turns (kept for fidelity) */
        recentTurns: ConversationTurn[];
        /** Summarized older segments */
        compressedSegments: CompressedSegment[];
    };

    /** Provenance: which models contributed what */
    provenance: ProvenanceEntry[];
}

/**
 * A compressed summary of a segment of conversation.
 */
export interface CompressedSegment {
    id: string;
    turnRange: [number, number]; // [startIndex, endIndex]
    summary: string;
    keyDecisions: string[];
    preservedInvariants: string[];
    originalTurnCount: number;
    compressionRatio: number;
}

/**
 * Provenance tracking — who did what.
 */
export interface ProvenanceEntry {
    platform: LLMPlatform;
    model: ModelIdentifier;
    turnIds: string[];
    timestamp: number;
}

// ─── Session & Platform Types ──────────────────────────────────────────────────

/**
 * A captured session from a single platform visit.
 */
export interface CapturedSession {
    id: string;
    platform: LLMPlatform;
    url: string;
    startedAt: number;
    endedAt?: number;
    turns: ConversationTurn[];
    model?: ModelIdentifier;
    systemPrompt?: string;
}

/**
 * Platform capability profile — what can each LLM do?
 */
export interface PlatformCapabilities {
    platform: LLMPlatform;
    supportsSystemPrompt: boolean;
    supportsStreaming: boolean;
    streamingProtocol: "sse" | "websocket" | "polling" | "unknown";
    maxContextTokens: number;
    supportsToolCalls: boolean;
    supportsCodeExecution: boolean;
    supportsFileUpload: boolean;
    injectionMethod: "system_prompt" | "user_message" | "prefill";
}

// ─── Messaging (Service Worker <-> Content Script) ─────────────────────────────

export type CLOMessageType =
    | "SESSION_STARTED"
    | "TURN_CAPTURED"
    | "SESSION_ENDED"
    | "STATE_REQUEST"
    | "STATE_RESPONSE"
    | "INJECT_STATE"
    | "PLATFORM_DETECTED"
    | "HUD_UPDATE"
    | "EXPORT_STATE"
    | "IMPORT_STATE";

export interface CLOMessage<T = unknown> {
    type: CLOMessageType;
    payload: T;
    timestamp: number;
    source: "content" | "background" | "popup";
}

// ─── State Diff (Semantic Delta Engine) ────────────────────────────────────────

export type DeltaOperation = "add" | "modify" | "remove";

export interface StateDelta {
    id: string;
    timestamp: number;
    field: keyof ReasoningState;
    operation: DeltaOperation;
    path: string; // JSON path within the field
    oldValue?: unknown;
    newValue?: unknown;
    turnId: string;
}
