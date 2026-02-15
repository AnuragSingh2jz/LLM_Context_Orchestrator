// ============================================================================
// CLO — IndexedDB Persistence Layer
// Stores reasoning states, sessions, and configuration using idb.
// ============================================================================

import { openDB, type IDBPDatabase } from "idb";
import type { ReasoningState, CapturedSession } from "./types";

const DB_NAME = "clo-store";
const DB_VERSION = 1;

interface CLODatabase {
    states: {
        key: string;
        value: ReasoningState;
        indexes: { "by-updated": number };
    };
    sessions: {
        key: string;
        value: CapturedSession;
        indexes: { "by-platform": string; "by-started": number };
    };
    config: {
        key: string;
        value: unknown;
    };
}

let dbPromise: Promise<IDBPDatabase<CLODatabase>> | null = null;

/**
 * Get or initialize the database connection.
 */
function getDB(): Promise<IDBPDatabase<CLODatabase>> {
    if (!dbPromise) {
        dbPromise = openDB<CLODatabase>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // States store
                const stateStore = db.createObjectStore("states", { keyPath: "id" });
                stateStore.createIndex("by-updated", "meta.updatedAt");

                // Sessions store
                const sessionStore = db.createObjectStore("sessions", {
                    keyPath: "id",
                });
                sessionStore.createIndex("by-platform", "platform");
                sessionStore.createIndex("by-started", "startedAt");

                // Config store
                db.createObjectStore("config");
            },
        });
    }
    return dbPromise;
}

// ─── State Operations ──────────────────────────────────────────────────────────

/**
 * Save a ReasoningState to the store.
 */
export async function saveState(state: ReasoningState): Promise<void> {
    const db = await getDB();
    await db.put("states", state);
}

/**
 * Load a ReasoningState by ID.
 */
export async function loadState(
    id: string
): Promise<ReasoningState | undefined> {
    const db = await getDB();
    return db.get("states", id);
}

/**
 * Get all stored ReasoningStates, ordered by most recently updated.
 */
export async function getAllStates(): Promise<ReasoningState[]> {
    const db = await getDB();
    const states = await db.getAllFromIndex("states", "by-updated");
    return states.reverse(); // Most recent first
}

/**
 * Delete a ReasoningState by ID.
 */
export async function deleteState(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("states", id);
}

/**
 * Get the most recently updated state (the "active" task).
 */
export async function getActiveState(): Promise<ReasoningState | undefined> {
    const states = await getAllStates();
    return states[0]; // Already sorted by most recent
}

// ─── Session Operations ────────────────────────────────────────────────────────

/**
 * Save a captured session.
 */
export async function saveSession(session: CapturedSession): Promise<void> {
    const db = await getDB();
    await db.put("sessions", session);
}

/**
 * Get all sessions for a specific platform.
 */
export async function getSessionsByPlatform(
    platform: string
): Promise<CapturedSession[]> {
    const db = await getDB();
    return db.getAllFromIndex("sessions", "by-platform", platform);
}

/**
 * Load a session by ID.
 */
export async function loadSession(
    id: string
): Promise<CapturedSession | undefined> {
    const db = await getDB();
    return db.get("sessions", id);
}

// ─── Config Operations ─────────────────────────────────────────────────────────

/**
 * Set a config value.
 */
export async function setConfig(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    await db.put("config", value, key);
}

/**
 * Get a config value.
 */
export async function getConfig<T = unknown>(
    key: string
): Promise<T | undefined> {
    const db = await getDB();
    return db.get("config", key) as Promise<T | undefined>;
}
