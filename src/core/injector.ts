// ============================================================================
// CLO — Cross-Model Injection Adapter
// Prepares and injects reasoning state into new LLM sessions.
// ============================================================================

import type { LLMPlatform, PlatformCapabilities, ReasoningState } from "./types";
import { compileStateToPrompt } from "./compressor";

/**
 * Known platform capabilities.
 */
const PLATFORM_PROFILES: Record<LLMPlatform, PlatformCapabilities> = {
    chatgpt: {
        platform: "chatgpt",
        supportsSystemPrompt: false, // Not user-accessible in web UI
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: true,
        supportsCodeExecution: true,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    claude: {
        platform: "claude",
        supportsSystemPrompt: false, // Not user-accessible in web UI
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 200000,
        supportsToolCalls: true,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    gemini: {
        platform: "gemini",
        supportsSystemPrompt: true, // System instructions available
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 1000000,
        supportsToolCalls: true,
        supportsCodeExecution: true,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    grok: {
        platform: "grok",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: false,
        injectionMethod: "user_message",
    },
    unknown: {
        platform: "unknown",
        supportsSystemPrompt: false,
        supportsStreaming: false,
        streamingProtocol: "unknown",
        maxContextTokens: 4000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: false,
        injectionMethod: "user_message",
    },
};

/**
 * Get the capability profile for a platform.
 */
export function getPlatformCapabilities(
    platform: LLMPlatform
): PlatformCapabilities {
    return PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.unknown;
}

/**
 * Prepare the injection payload for a specific platform.
 *
 * Returns the text to be injected and the recommended method.
 */
export function prepareInjectionPayload(
    state: ReasoningState,
    targetPlatform: LLMPlatform
): {
    text: string;
    method: PlatformCapabilities["injectionMethod"];
    tokenEstimate: number;
} {
    const caps = getPlatformCapabilities(targetPlatform);

    // Budget: use ~25% of available context for state injection
    const tokenBudget = Math.floor(caps.maxContextTokens * 0.25);

    const compiled = compileStateToPrompt(state, tokenBudget);

    // Wrap with injection framing
    const injectionText = buildInjectionWrapper(compiled, targetPlatform, caps);

    return {
        text: injectionText,
        method: caps.injectionMethod,
        tokenEstimate: Math.ceil(injectionText.length / 4),
    };
}

/**
 * Build the injection wrapper — frames the context for the target model.
 */
function buildInjectionWrapper(
    compiledState: string,
    platform: LLMPlatform,
    caps: PlatformCapabilities
): string {
    const header = `[CONTEXT CONTINUATION — Injected by CLO (Cross-LLM Context Orchestrator)]
You are continuing a task that was previously worked on across multiple LLM sessions.
The following is a structured state snapshot. Treat it as ground truth for the task.
Do NOT re-derive or question the decisions below unless asked.
Resume from where the previous session left off.

`;

    const footer = `
---
[END OF INJECTED CONTEXT]
Please acknowledge this context and continue with the next action described above.`;

    return header + compiledState + footer;
}

/**
 * Inject text into the active LLM input field.
 *
 * This is called from the content script. It finds the input textarea/editor
 * and populates it with the injection payload.
 */
export function injectIntoInputField(
    text: string,
    platform: LLMPlatform
): boolean {
    const selectors = getInputSelectors(platform);

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            if (element instanceof HTMLTextAreaElement) {
                element.value = text;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
            }

            // ContentEditable divs (used by most LLMs)
            if (element.getAttribute("contenteditable") === "true") {
                element.textContent = text;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                return true;
            }

            // ProseMirror or similar rich editors
            const editable = element.querySelector('[contenteditable="true"]');
            if (editable) {
                editable.textContent = text;
                editable.dispatchEvent(new Event("input", { bubbles: true }));
                return true;
            }
        }
    }

    return false;
}

/**
 * Get input field selectors for each platform.
 * These need to be maintained as platforms update their UIs.
 */
function getInputSelectors(platform: LLMPlatform): string[] {
    switch (platform) {
        case "chatgpt":
            return [
                "#prompt-textarea",
                'textarea[data-id="root"]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "claude":
            return [
                '[contenteditable="true"].ProseMirror',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "gemini":
            return [
                ".ql-editor",
                '[contenteditable="true"]',
                'textarea[aria-label]',
                "textarea",
            ];
        case "grok":
            return [
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        default:
            return ['[contenteditable="true"]', "textarea"];
    }
}
