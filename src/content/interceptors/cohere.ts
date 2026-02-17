// ============================================================================
// CLO — Cohere (Coral) Interceptor
// Captures conversation turns from the Cohere chat web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class CohereInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "cohere";

    start(): void {
        console.log("[CLO] Cohere interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            const container =
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="messages"]') ||
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [data-message-type], [class*="Message"]',
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
        const msgType = el.getAttribute("data-message-type") || "";

        if (msgType === "user" || classes.includes("user")) return "user";
        if (msgType === "chatbot" || msgType === "assistant" || classes.includes("assistant") || classes.includes("bot")) return "assistant";

        const parent = el.closest('[data-message-type], [class*="user"], [class*="assistant"], [class*="bot"]');
        if (parent) {
            const role = parent.getAttribute("data-message-type") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("chatbot") || role.includes("assistant") || role.includes("bot")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        return "command-r-plus";
    }
}
