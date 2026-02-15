// ============================================================================
// CLO — Popup Controller
// Handles the extension popup UI logic.
// ============================================================================

import type { CLOMessage, ReasoningState } from "../core/types";
import { createEmptyState, exportState, importState } from "../core/serializer";

// ─── Initialization ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    await refreshState();
    setupListeners();
    setupMessageHandler();
});

/**
 * Request current state from background and update UI.
 */
async function refreshState(): Promise<void> {
    try {
        const response = await chrome.runtime.sendMessage({
            type: "STATE_REQUEST",
            payload: {},
            timestamp: Date.now(),
            source: "popup",
        } as CLOMessage);

        if (response?.state) {
            renderState(response.state as ReasoningState);
        }

        // Check active tabs for platform info
        if (response?.activeTabs) {
            const tabs = response.activeTabs as Record<
                string,
                { platform: string; url: string }
            >;
            const entries = Object.values(tabs);
            if (entries.length > 0) {
                const latest = entries[entries.length - 1];
                updatePlatformBadge(latest.platform);
                updateStatusText("Capturing");
            }
        }
    } catch (e) {
        console.warn("[CLO Popup] Failed to get state:", e);
        updateStatusText("Disconnected");
        const dot = document.getElementById("popup-status-dot");
        if (dot) dot.classList.remove("active");
    }
}

/**
 * Render the reasoning state into the popup UI.
 */
function renderState(state: ReasoningState): void {
    // Task info
    const titleEl = document.getElementById("popup-task-title");
    const objectiveEl = document.getElementById("popup-task-objective");
    if (titleEl) titleEl.textContent = state.meta.title || "Untitled Task";
    if (objectiveEl)
        objectiveEl.textContent =
            state.meta.objective || "No objective set yet.";

    // Stats
    setStatValue("popup-turns", state.meta.totalTurns);
    setStatValue("popup-artifacts", state.artifacts.length);
    setStatValue("popup-constraints", state.constraints.length);
    setStatValue("popup-decisions", state.decisions.length);
    setStatValue("popup-models", state.meta.models.length);
    setStatValue("popup-platforms", state.meta.platforms.length);

    // Provenance chain
    renderProvenance(state);
}

/**
 * Render the provenance timeline.
 */
function renderProvenance(state: ReasoningState): void {
    const container = document.getElementById("popup-provenance-list");
    if (!container) return;

    if (state.provenance.length === 0) {
        container.innerHTML =
            '<div class="provenance-empty">No cross-model activity yet</div>';
        return;
    }

    const platformColors: Record<string, string> = {
        chatgpt: "#10a37f",
        claude: "#d97757",
        gemini: "#4285f4",
        grok: "#e8e8e8",
        unknown: "#888",
    };

    container.innerHTML = state.provenance
        .map(
            (p) => `
    <div class="provenance-entry">
      <span class="provenance-dot" style="background: ${platformColors[p.platform] || "#888"}"></span>
      <span class="provenance-model">${p.model}</span>
      <span class="provenance-turns">${p.turnIds.length} turns</span>
    </div>
  `
        )
        .join("");
}

// ─── Button Handlers ───────────────────────────────────────────────────────────

function setupListeners(): void {
    // Inject button
    document.getElementById("popup-inject-btn")?.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.runtime.sendMessage({
                type: "INJECT_STATE",
                payload: { tabId: tab.id },
                timestamp: Date.now(),
                source: "popup",
            } as CLOMessage);
        }
    });

    // Export button
    document.getElementById("popup-export-btn")?.addEventListener("click", async () => {
        const response = await chrome.runtime.sendMessage({
            type: "EXPORT_STATE",
            payload: {},
            timestamp: Date.now(),
            source: "popup",
        } as CLOMessage);

        if (response?.state) {
            const json = JSON.stringify(response.state, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `clo-state-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });

    // Import button
    document.getElementById("popup-import-btn")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const state = importState(text);
                await chrome.runtime.sendMessage({
                    type: "IMPORT_STATE",
                    payload: { state },
                    timestamp: Date.now(),
                    source: "popup",
                } as CLOMessage);
                await refreshState();
            } catch (err) {
                console.error("[CLO Popup] Import failed:", err);
            }
        };
        input.click();
    });

    // New task button
    document.getElementById("popup-new-btn")?.addEventListener("click", async () => {
        const title = prompt("Task title:", "New Task");
        if (title) {
            const newState = createEmptyState(title);
            await chrome.runtime.sendMessage({
                type: "IMPORT_STATE",
                payload: { state: newState },
                timestamp: Date.now(),
                source: "popup",
            } as CLOMessage);
            await refreshState();
        }
    });
}

// ─── Real-time Updates ─────────────────────────────────────────────────────────

function setupMessageHandler(): void {
    chrome.runtime.onMessage.addListener((message: CLOMessage) => {
        if (message.type === "HUD_UPDATE" && message.source === "background") {
            const data = message.payload as {
                totalTurns: number;
                platforms: string[];
                models: string[];
                artifacts: number;
                constraints: number;
                decisions: number;
            };
            setStatValue("popup-turns", data.totalTurns);
            setStatValue("popup-artifacts", data.artifacts);
            setStatValue("popup-constraints", data.constraints);
            setStatValue("popup-decisions", data.decisions);
            setStatValue("popup-models", data.models.length);
            setStatValue("popup-platforms", data.platforms.length);
        }
    });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setStatValue(id: string, value: number): void {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

function updatePlatformBadge(platform: string): void {
    const badge = document.getElementById("popup-platform-badge");
    if (badge) {
        badge.textContent = platform.toUpperCase();
        badge.className = `platform-badge ${platform}`;
    }
}

function updateStatusText(text: string): void {
    const el = document.getElementById("popup-status-text");
    if (el) el.textContent = text;
}
