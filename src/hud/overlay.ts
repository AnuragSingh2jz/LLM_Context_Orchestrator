// ============================================================================
// CLO — HUD Overlay Controller
// In-page floating panel showing CLO status and quick actions.
// ============================================================================

import type { LLMPlatform } from "../core/types";

interface HUDState {
    platform: LLMPlatform;
    status: "active" | "capturing" | "idle" | "unsupported";
    turns: number;
}

let hudElement: HTMLDivElement | null = null;
let isMinimized = false;

/**
 * Create the HUD overlay element and inject it into the page.
 */
export function createHUD(): void {
    if (hudElement) return;

    hudElement = document.createElement("div");
    hudElement.id = "clo-hud";
    hudElement.innerHTML = `
    <button id="clo-hud-toggle" title="CLO — Cross-LLM Context Orchestrator">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    </button>
    <div id="clo-hud-panel">
      <div class="clo-header">
        <span class="clo-logo">CLO</span>
        <span class="clo-status-dot" id="clo-status-dot"></span>
        <span style="flex:1"></span>
        <span style="font-size:10px;color:rgba(255,255,255,0.3);font-family:var(--clo-font-mono)">v0.1</span>
      </div>
      <div class="clo-platform" id="clo-platform-info">
        <span class="clo-platform-dot" id="clo-platform-dot"></span>
        <span id="clo-platform-name">Detecting...</span>
      </div>
      <div class="clo-stats">
        <div class="clo-stat">
          <div class="clo-stat-value" id="clo-stat-turns">0</div>
          <div class="clo-stat-label">Turns</div>
        </div>
        <div class="clo-stat">
          <div class="clo-stat-value" id="clo-stat-artifacts">0</div>
          <div class="clo-stat-label">Artifacts</div>
        </div>
        <div class="clo-stat">
          <div class="clo-stat-value" id="clo-stat-constraints">0</div>
          <div class="clo-stat-label">Constraints</div>
        </div>
        <div class="clo-stat">
          <div class="clo-stat-value" id="clo-stat-decisions">0</div>
          <div class="clo-stat-label">Decisions</div>
        </div>
      </div>
      <div class="clo-actions">
        <button class="clo-btn primary" id="clo-btn-inject">⚡ Inject</button>
        <button class="clo-btn" id="clo-btn-export">📤 Export</button>
        <button class="clo-btn" id="clo-btn-view">👁 View</button>
      </div>
    </div>
  `;

    document.body.appendChild(hudElement);

    // ── Toggle behavior ─────────────────────────────────────────────────────
    const toggleBtn = hudElement.querySelector("#clo-hud-toggle");
    toggleBtn?.addEventListener("click", () => {
        isMinimized = !isMinimized;
        hudElement?.classList.toggle("minimized", isMinimized);
    });

    // ── Button handlers ─────────────────────────────────────────────────────
    const injectBtn = hudElement.querySelector("#clo-btn-inject");
    injectBtn?.addEventListener("click", () => {
        chrome.runtime.sendMessage({
            type: "INJECT_STATE",
            payload: {},
            timestamp: Date.now(),
            source: "content",
        });
    });

    const exportBtn = hudElement.querySelector("#clo-btn-export");
    exportBtn?.addEventListener("click", () => {
        chrome.runtime.sendMessage(
            {
                type: "EXPORT_STATE",
                payload: {},
                timestamp: Date.now(),
                source: "content",
            },
            (response) => {
                if (response?.state) {
                    const blob = new Blob([JSON.stringify(response.state, null, 2)], {
                        type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `clo-state-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showNotification("State exported ✓", "success");
                }
            }
        );
    });

    const viewBtn = hudElement.querySelector("#clo-btn-view");
    viewBtn?.addEventListener("click", () => {
        chrome.runtime.sendMessage(
            {
                type: "STATE_REQUEST",
                payload: {},
                timestamp: Date.now(),
                source: "content",
            },
            (response) => {
                if (response?.state) {
                    console.log("[CLO] Current Reasoning State:", response.state);
                    showNotification("State logged to console", "info");
                }
            }
        );
    });
}

/**
 * Update the HUD display with new state data.
 */
export function updateHUD(state: HUDState): void {
    if (!hudElement) return;

    // Platform
    const platformName = hudElement.querySelector("#clo-platform-name");
    const platformDot = hudElement.querySelector("#clo-platform-dot");
    if (platformName) platformName.textContent = capitalize(state.platform);
    if (platformDot) platformDot.className = `clo-platform-dot ${state.platform}`;

    // Status dot
    const statusDot = hudElement.querySelector("#clo-status-dot");
    if (statusDot) {
        statusDot.className = "clo-status-dot";
        if (state.status === "unsupported") statusDot.classList.add("warning");
        if (state.status === "idle") statusDot.classList.add("error");
    }

    // Turns
    const turnsEl = hudElement.querySelector("#clo-stat-turns");
    if (turnsEl) turnsEl.textContent = String(state.turns);
}

/**
 * Update individual stats (called from background updates).
 */
export function updateStats(data: {
    turns?: number;
    artifacts?: number;
    constraints?: number;
    decisions?: number;
}): void {
    if (!hudElement) return;

    if (data.turns !== undefined) {
        const el = hudElement.querySelector("#clo-stat-turns");
        if (el) el.textContent = String(data.turns);
    }
    if (data.artifacts !== undefined) {
        const el = hudElement.querySelector("#clo-stat-artifacts");
        if (el) el.textContent = String(data.artifacts);
    }
    if (data.constraints !== undefined) {
        const el = hudElement.querySelector("#clo-stat-constraints");
        if (el) el.textContent = String(data.constraints);
    }
    if (data.decisions !== undefined) {
        const el = hudElement.querySelector("#clo-stat-decisions");
        if (el) el.textContent = String(data.decisions);
    }
}

/**
 * Show a notification toast.
 */
export function showNotification(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
): void {
    // Remove existing notification
    const existing = document.querySelector("#clo-notification");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "clo-notification";
    toast.className = type;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add("visible");
    });

    // Auto-dismiss
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
