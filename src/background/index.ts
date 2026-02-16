// ============================================================================
// CLO — Background Service Worker
// Central orchestrator: manages state, handles messages, coordinates sessions.
// ============================================================================

import type { CLOMessage, ConversationTurn, LLMPlatform, ReasoningState } from "../core/types";
import { createEmptyState, ingestTurn } from "../core/serializer";
import { compressHistory } from "../core/compressor";
import { prepareInjectionPayload } from "../core/injector";
import { saveState, getActiveState, getAllStates, loadState } from "../core/store";

/**
 * In-memory active state reference.
 * Persisted to IndexedDB on each update.
 */
let activeState: ReasoningState | null = null;

/**
 * Active platform tabs being tracked.
 */
const activeTabs: Map<number, { platform: LLMPlatform; url: string }> = new Map();

// ─── Initialization ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
    console.log("[CLO Background] Extension installed");
    activeState = await getActiveState() || null;
    if (!activeState) {
        activeState = createEmptyState("New Task");
        await saveState(activeState);
    }
    console.log("[CLO Background] Active state loaded:", activeState.id);
});

chrome.runtime.onStartup.addListener(async () => {
    activeState = await getActiveState() || null;
});

// ─── Message Handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
    (message: CLOMessage, sender, sendResponse) => {
        handleMessage(message, sender, sendResponse).catch((err) => {
            console.error("[CLO Background] Message handler error:", err);
            sendResponse({ error: err.message });
        });
        return true; // Keep channel open for async
    }
);

async function handleMessage(
    message: CLOMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
): Promise<void> {
    switch (message.type) {
        case "PLATFORM_DETECTED": {
            const { platform, url } = message.payload as {
                platform: LLMPlatform;
                url: string;
            };
            if (sender.tab?.id) {
                activeTabs.set(sender.tab.id, { platform, url });
            }
            console.log(`[CLO Background] Platform detected: ${platform} at ${url}`);

            // Update badge
            chrome.action.setBadgeText({
                text: platform.slice(0, 3).toUpperCase(),
                tabId: sender.tab?.id,
            });
            chrome.action.setBadgeBackgroundColor({
                color: getPlatformColor(platform),
                tabId: sender.tab?.id,
            });
            sendResponse({ acknowledged: true });
            break;
        }

        case "TURN_CAPTURED": {
            const { turn, platform, model } = message.payload as {
                turn: ConversationTurn;
                platform: LLMPlatform;
                model?: string;
            };

            if (!activeState) {
                activeState = createEmptyState("Auto-captured Task");
            }

            // Ingest the turn into the reasoning state
            activeState = ingestTurn(activeState, turn, platform, model);

            // Compress if history is getting long
            if (activeState.history.recentTurns.length > 15) {
                activeState = compressHistory(activeState);
            }

            // Persist
            await saveState(activeState);
            console.log(
                `[CLO Background] Turn ingested. Total: ${activeState.meta.totalTurns}`
            );

            // Notify popup if open
            broadcastToPopup({
                type: "HUD_UPDATE",
                payload: {
                    totalTurns: activeState.meta.totalTurns,
                    platforms: activeState.meta.platforms,
                    models: activeState.meta.models,
                    artifacts: activeState.artifacts.length,
                    constraints: activeState.constraints.length,
                    decisions: activeState.decisions.length,
                },
                timestamp: Date.now(),
                source: "background",
            });

            sendResponse({ success: true, totalTurns: activeState.meta.totalTurns });
            break;
        }

        case "STATE_REQUEST": {
            sendResponse({
                state: activeState,
                activeTabs: Object.fromEntries(activeTabs),
            });
            break;
        }

        case "INJECT_STATE": {
            const { tabId, stateId } = message.payload as {
                tabId?: number;
                stateId?: string;
            };

            const stateToInject = stateId
                ? await loadState(stateId)
                : activeState;

            if (!stateToInject) {
                sendResponse({ error: "No state to inject" });
                return;
            }

            const targetTabId = tabId || findActiveTab();
            if (!targetTabId) {
                sendResponse({ error: "No target tab found" });
                return;
            }

            const tabInfo = activeTabs.get(targetTabId);
            const targetPlatform = tabInfo?.platform || "unknown";
            const payload = prepareInjectionPayload(stateToInject, targetPlatform);

            // Send injection command to content script
            chrome.tabs.sendMessage(targetTabId, {
                type: "INJECT_STATE",
                payload: { text: payload.text },
                timestamp: Date.now(),
                source: "background",
            } as CLOMessage);

            sendResponse({
                success: true,
                tokenEstimate: payload.tokenEstimate,
                method: payload.method,
            });
            break;
        }

        case "EXPORT_STATE": {
            const { stateId: exportId } = message.payload as { stateId?: string };
            const stateToExport = exportId
                ? await loadState(exportId)
                : activeState;
            sendResponse({ state: stateToExport });
            break;
        }

        case "IMPORT_STATE": {
            try {
                const { state } = message.payload as { state: ReasoningState };
                
                // Validate that the state is a valid ReasoningState object
                if (!state || typeof state !== "object") {
                    throw new Error("Invalid state object");
                }
                
                if (!state.id || !state.meta) {
                    throw new Error("State missing required fields");
                }

                activeState = state;
                await saveState(state);
                
                console.log("[CLO Background] State imported successfully:", state.meta.title);
                sendResponse({ 
                    success: true,
                    message: `Imported state: ${state.meta.title}`,
                    stateId: state.id
                });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error("[CLO Background] Import failed:", errorMsg);
                sendResponse({ 
                    success: false, 
                    error: errorMsg 
                });
            }
            break;
        }

        default:
            sendResponse({ error: `Unknown message type: ${message.type}` });
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getPlatformColor(platform: LLMPlatform): string {
    const colors: Record<LLMPlatform, string> = {
        chatgpt: "#10A37F",
        claude: "#D97757",
        gemini: "#4285F4",
        grok: "#000000",
        unknown: "#888888",
    };
    return colors[platform];
}

function findActiveTab(): number | null {
    for (const [tabId] of activeTabs) {
        return tabId;
    }
    return null;
}

function broadcastToPopup(message: CLOMessage): void {
    chrome.runtime.sendMessage(message).catch(() => {
        // Popup not open, ignore
    });
}

// ─── Tab lifecycle ─────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
        // URL changed — may need to re-evaluate platform
        const existing = activeTabs.get(tabId);
        if (existing && !changeInfo.url.includes(existing.platform)) {
            activeTabs.delete(tabId);
        }
    }
});
