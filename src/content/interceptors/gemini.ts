// ============================================================================
// CLO — Gemini Interceptor
// Captures conversation turns from the Gemini web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class GeminiInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "gemini";

    start(): void {
        console.log("[CLO] Gemini interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Gemini uses a specific container structure
            const container =
                document.querySelector("chat-window") ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    "message-content, [class*='message-content'], model-response, user-query",
                    this.detectRole.bind(this)
                );
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    }

    private detectRole(el: Element): MessageRole | null {
        const tag = el.tagName.toLowerCase();

        if (tag === "user-query" || tag.includes("user")) return "user";
        if (tag === "model-response" || tag.includes("model")) return "assistant";

        const classes = el.className || "";
        if (classes.includes("user") || classes.includes("query")) return "user";
        if (classes.includes("model") || classes.includes("response"))
            return "assistant";

        // Check parent structure
        const parent = el.closest("[class*='user'], [class*='model']");
        if (parent) {
            const parentClass = parent.className || "";
            if (parentClass.includes("user")) return "user";
            if (parentClass.includes("model")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        // Gemini shows model selection
        const modelEl =
            document.querySelector('[class*="model-picker"]') ||
            document.querySelector('[aria-label*="model"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("2.0 flash")) return "gemini-2.0-flash";
            if (text.includes("2.0 pro")) return "gemini-2.0-pro";
            if (text.includes("1.5 pro")) return "gemini-1.5-pro";
            if (text.includes("ultra")) return "gemini-ultra";
            return text;
        }
        return "gemini-unknown";
    }
}
