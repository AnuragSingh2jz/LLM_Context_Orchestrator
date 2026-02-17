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

        // ── Tab visibility change: re-scan when user switches back ──────────
        // This fixes the "no capture until reload" bug — when the user switches
        // to a tab that already has an LLM conversation, we re-scan the page
        // for any messages that were present before CLO started observing.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                console.log("[CLO] Tab became visible, re-scanning for messages...");
                interceptor.rescan();
            }
        });

        // ── SPA navigation: detect URL changes without page reload ──────────
        // Many LLM platforms (ChatGPT, Claude, etc.) use client-side routing.
        // When the user navigates to a new conversation, we need to re-scan.
        let lastUrl = window.location.href;
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log("[CLO] URL changed (SPA navigation), restarting interceptor...");

                // Brief delay to let the new page render
                setTimeout(() => {
                    interceptor.stop();
                    interceptor.start();
                }, 1500);
            }
        });

        urlObserver.observe(document, { subtree: true, childList: true });

    } else {
        updateHUD({ platform, status: "unsupported", turns: 0 });
        showNotification(`Platform "${platform}" not fully supported yet`, "warning");
    }

    // ── Listen for commands from background/popup ────────────────────────────
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

        if (message.type === "RESCAN") {
            console.log("[CLO] Received RESCAN command from background");
            if (interceptor) {
                interceptor.rescan();
            }
            sendResponse({ ok: true });
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
