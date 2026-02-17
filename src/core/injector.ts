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
        supportsSystemPrompt: false,
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
        supportsSystemPrompt: false,
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
        supportsSystemPrompt: true,
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
    perplexity: {
        platform: "perplexity",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    deepseek: {
        platform: "deepseek",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: true,
        supportsCodeExecution: true,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    kimi: {
        platform: "kimi",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 200000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    manus: {
        platform: "manus",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: true,
        supportsCodeExecution: true,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    copilot: {
        platform: "copilot",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    you: {
        platform: "you",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: false,
        injectionMethod: "user_message",
    },
    poe: {
        platform: "poe",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "websocket",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    huggingchat: {
        platform: "huggingchat",
        supportsSystemPrompt: true,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 32000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: false,
        injectionMethod: "user_message",
    },
    qwen: {
        platform: "qwen",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: false,
        supportsCodeExecution: false,
        supportsFileUpload: true,
        injectionMethod: "user_message",
    },
    mistral: {
        platform: "mistral",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: true,
        supportsCodeExecution: false,
        supportsFileUpload: false,
        injectionMethod: "user_message",
    },
    cohere: {
        platform: "cohere",
        supportsSystemPrompt: false,
        supportsStreaming: true,
        streamingProtocol: "sse",
        maxContextTokens: 128000,
        supportsToolCalls: true,
        supportsCodeExecution: false,
        supportsFileUpload: true,
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
 *
 * FIXED: Properly handles React-controlled inputs, ProseMirror editors,
 * and contenteditable divs with correct event dispatching.
 */
export function injectIntoInputField(
    text: string,
    platform: LLMPlatform
): boolean {
    const selectors = getInputSelectors(platform);

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            // Method 1: Standard textarea
            if (element instanceof HTMLTextAreaElement) {
                return injectIntoTextarea(element, text);
            }

            // Method 2: Standard input
            if (element instanceof HTMLInputElement) {
                return injectIntoTextarea(element, text);
            }

            // Method 3: ContentEditable div (including ProseMirror)
            if (element.getAttribute("contenteditable") === "true") {
                return injectIntoContentEditable(element as HTMLElement, text);
            }

            // Method 4: Nested contenteditable inside a wrapper
            const editable = element.querySelector('[contenteditable="true"]');
            if (editable) {
                return injectIntoContentEditable(editable as HTMLElement, text);
            }

            // Method 5: Nested textarea inside a wrapper
            const nestedTextarea = element.querySelector("textarea");
            if (nestedTextarea) {
                return injectIntoTextarea(nestedTextarea, text);
            }
        }
    }

    // Fallback: try any contenteditable or textarea on the page
    const fallbackEditable = document.querySelector(
        'main [contenteditable="true"], [role="textbox"], main textarea'
    );
    if (fallbackEditable) {
        if (fallbackEditable instanceof HTMLTextAreaElement) {
            return injectIntoTextarea(fallbackEditable, text);
        }
        if (fallbackEditable.getAttribute("contenteditable") === "true" || fallbackEditable.getAttribute("role") === "textbox") {
            return injectIntoContentEditable(fallbackEditable as HTMLElement, text);
        }
    }

    return false;
}

/**
 * Inject text into a textarea or input element.
 *
 * FIXED: Uses the native input value setter to properly trigger React's
 * synthetic event system, which doesn't respond to simple `.value =` assignments.
 */
function injectIntoTextarea(
    element: HTMLTextAreaElement | HTMLInputElement,
    text: string
): boolean {
    try {
        // Use the native setter to bypass React's controlled component logic
        const nativeInputValueSetter =
            Object.getOwnPropertyDescriptor(
                element instanceof HTMLTextAreaElement
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype,
                "value"
            )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, text);
        } else {
            element.value = text;
        }

        // Dispatch events that React and other frameworks listen to
        element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

        // Also dispatch a keyboard event to trigger any keyup handlers
        element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

        // Focus the element so the user can immediately send
        element.focus();

        return true;
    } catch (e) {
        console.warn("[CLO] Textarea injection failed:", e);
        return false;
    }
}

/**
 * Inject text into a contenteditable element.
 *
 * FIXED: Properly handles ProseMirror, TipTap, Lexical, and other rich-text
 * editors by using execCommand for undo-compatible insertion and dispatching
 * the correct InputEvent type.
 */
function injectIntoContentEditable(
    element: HTMLElement,
    text: string
): boolean {
    try {
        // Focus first — many editors require focus before accepting input
        element.focus();

        // Clear existing content
        const selection = window.getSelection();
        if (selection) {
            selection.selectAllChildren(element);
            selection.deleteFromDocument();
        }

        // Try insertText command first (works with most rich editors and supports undo)
        const inserted = document.execCommand("insertText", false, text);

        if (!inserted) {
            // Fallback: direct DOM manipulation
            // Handle ProseMirror's paragraph structure
            const isProseMirror = element.classList.contains("ProseMirror") ||
                element.closest(".ProseMirror") !== null;

            if (isProseMirror) {
                // ProseMirror wraps content in <p> tags
                const paragraphs = text.split("\n").map((line) => {
                    const p = document.createElement("p");
                    p.textContent = line || "\u200B"; // Zero-width space for empty lines
                    return p;
                });
                element.innerHTML = "";
                for (const p of paragraphs) {
                    element.appendChild(p);
                }
            } else {
                element.textContent = text;
            }
        }

        // Dispatch InputEvent (the standard for contenteditable)
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: text,
            })
        );

        // Also dispatch a generic Event for frameworks that listen to it
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));

        // Dispatch composition events (some editors like Lexical use these)
        element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: text }));

        return true;
    } catch (e) {
        console.warn("[CLO] ContentEditable injection failed:", e);

        // Last resort fallback
        try {
            element.textContent = text;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            return true;
        } catch {
            return false;
        }
    }
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
                '[data-testid="text-input"]',
                'textarea[data-id="root"]',
                '[contenteditable="true"].ProseMirror',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "claude":
            return [
                '[contenteditable="true"].ProseMirror',
                'fieldset [contenteditable="true"]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "gemini":
            return [
                ".ql-editor",
                'rich-textarea [contenteditable="true"]',
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
        case "perplexity":
            return [
                'textarea[placeholder]',
                'textarea[autocomplete]',
                '[contenteditable="true"]',
                'input[type="text"]',
                "textarea",
            ];
        case "deepseek":
            return [
                '#chat-input',
                'textarea[class*="chat"]',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "kimi":
            return [
                'textarea[class*="input"]',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "manus":
            return [
                'textarea[class*="input"]',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                'input[type="text"]',
                "textarea",
            ];
        case "copilot":
            return [
                '#searchbox',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
                'input[type="text"]',
            ];
        case "you":
            return [
                'textarea[placeholder]',
                'input[type="search"]',
                'input[type="text"]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "poe":
            return [
                '[class*="ChatMessageInput"] textarea',
                'textarea[class*="TextInput"]',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "huggingchat":
            return [
                'textarea[placeholder]',
                'textarea[enterkeyhint]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "qwen":
            return [
                'textarea[class*="input"]',
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "mistral":
            return [
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        case "cohere":
            return [
                'textarea[placeholder]',
                '[contenteditable="true"]',
                "textarea",
            ];
        default:
            return [
                '[contenteditable="true"]',
                'textarea[placeholder]',
                "textarea",
                'input[type="text"]',
            ];
    }
}
