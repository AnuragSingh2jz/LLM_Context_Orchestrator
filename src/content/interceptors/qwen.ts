// ============================================================================
// CLO — Qwen (Tongyi Qianwen) Interceptor
// Captures conversation turns from the Qwen web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class QwenInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "qwen";

    start(): void {
        console.log("[CLO] Qwen interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            const container =
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector('[class*="message-list"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [data-role], [class*="chat-item"]',
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
        if (dataRole === "assistant" || classes.includes("assistant") || classes.includes("bot")) return "assistant";

        const parent = el.closest('[data-role], [class*="user"], [class*="assistant"]');
        if (parent) {
            const role = parent.getAttribute("data-role") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        return "qwen-chat";
    }
}
