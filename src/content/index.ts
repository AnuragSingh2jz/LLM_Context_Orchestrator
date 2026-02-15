// ============================================================================
// CLO — Content Script Entry Point
// Injected into LLM platform pages to capture conversation data.
// ============================================================================

import { detectPlatform, getInterceptor } from "./interceptors/index";
import { injectIntoInputField } from "../core/injector";
import type { CLOMessage, ConversationTurn, CapturedSession } from "../core/types";
import { createHUD, updateHUD, showNotification } from "../hud/overlay";

const platform = detectPlatform();

if (platform === "unknown") {
    console.log("[CLO] Not a supported platform, exiting.");
} else {
    console.log(`[CLO] Detected platform: ${platform}`);
    initCLO();
}

/**
 * Initialize the CLO content script.
 */
function initCLO(): void {
    // ── Create the HUD overlay ──────────────────────────────────────────────
    createHUD();
    updateHUD({ platform, status: "active", turns: 0 });
    showNotification(`CLO active on ${platform}`, "info");

    // ── Notify background service worker ────────────────────────────────────
    sendMessage({
        type: "PLATFORM_DETECTED",
        payload: { platform, url: window.location.href },
        timestamp: Date.now(),
        source: "content",
    });

    // ── Start the interceptor ──────────────────────────────────────────────
    const interceptor = getInterceptor(platform);
    let turnCount = 0;

    if (interceptor) {
        interceptor.onTurn((turn: ConversationTurn) => {
            turnCount++;
            console.log(`[CLO] Captured turn #${turnCount}:`, turn.role, turn.content.slice(0, 100));

            // Update HUD
            updateHUD({ platform, status: "capturing", turns: turnCount });

            // Send to background for state ingestion
            sendMessage({
                type: "TURN_CAPTURED",
                payload: {
                    turn,
                    platform,
                    model: turn.model,
                },
                timestamp: Date.now(),
                source: "content",
            });
        });

        interceptor.start();
    } else {
        updateHUD({ platform, status: "unsupported", turns: 0 });
        showNotification(`Platform "${platform}" not fully supported yet`, "warning");
    }

    // ── Listen for injection commands from background/popup ─────────────────
    chrome.runtime.onMessage.addListener((message: CLOMessage, _sender, sendResponse) => {
        if (message.type === "INJECT_STATE") {
            const { text } = message.payload as { text: string };
            const success = injectIntoInputField(text, platform);
            showNotification(
                success ? "Context injected ✓" : "Injection failed — input not found",
                success ? "success" : "error"
            );
            sendResponse({ success });
        }
        return true; // Keep channel open for async response
    });
}

/**
 * Send a message to the background service worker.
 */
function sendMessage(message: CLOMessage): void {
    try {
        chrome.runtime.sendMessage(message);
    } catch (e) {
        console.warn("[CLO] Failed to send message:", e);
    }
}
