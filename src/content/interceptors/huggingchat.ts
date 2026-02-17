// ============================================================================
// CLO — HuggingChat Interceptor
// Captures conversation turns from the HuggingChat web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class HuggingChatInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "huggingchat";

    start(): void {
        console.log("[CLO] HuggingChat interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // HuggingChat is open-source and uses a scrollable chat container
            const container =
                document.querySelector('[class*="messages"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [data-message-role], [class*="prose"]',
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
        const role = el.getAttribute("data-message-role") || "";

        if (role === "user" || classes.includes("user")) return "user";
        if (role === "assistant" || classes.includes("assistant")) return "assistant";

        // Check parent for role
        const parent = el.closest('[data-message-role], [class*="user"], [class*="assistant"]');
        if (parent) {
            const pRole = parent.getAttribute("data-message-role") || parent.className || "";
            if (pRole.includes("user")) return "user";
            if (pRole.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl =
            document.querySelector('[class*="model-selector"]') ||
            document.querySelector('select[name="model"]') ||
            document.querySelector('button[class*="model"]');

        if (modelEl?.textContent) {
            return modelEl.textContent.trim().toLowerCase();
        }
        return "huggingchat-default";
    }
}
