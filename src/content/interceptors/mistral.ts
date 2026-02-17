// ============================================================================
// CLO — Mistral (Le Chat) Interceptor
// Captures conversation turns from the Mistral chat web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class MistralInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "mistral";

    start(): void {
        console.log("[CLO] Mistral interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            const container =
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="chat-messages"]') ||
                document.querySelector('[class*="message-list"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [data-role], [class*="Message"]',
                    this.detectRole.bind(this)
                );
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    }

    private detectRole(el: Element): MessageRole | null {
        const classes = el.className || "";
        const dataRole = el.getAttribute("data-role") || "";

        if (dataRole === "user" || classes.includes("user")) return "user";
        if (dataRole === "assistant" || classes.includes("assistant")) return "assistant";

        const parent = el.closest('[data-role], [class*="user"], [class*="assistant"]');
        if (parent) {
            const role = parent.getAttribute("data-role") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl = document.querySelector('[class*="model-selector"], [class*="ModelSelector"]');
        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("large")) return "mistral-large";
            if (text.includes("medium")) return "mistral-medium";
            if (text.includes("small")) return "mistral-small";
            return text;
        }
        return "mistral-chat";
    }
}
