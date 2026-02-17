// ============================================================================
// CLO — Manus AI Interceptor
// Captures conversation turns from the Manus AI web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class ManusInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "manus";

    start(): void {
        console.log("[CLO] Manus AI interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Manus AI uses a chat interface for conversation
            const container =
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="message-list"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [class*="chat-message"], [class*="bubble"], [data-role]',
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
        if (dataRole === "assistant" || classes.includes("assistant") || classes.includes("agent")) return "assistant";

        // Check for tool/agent actions
        if (classes.includes("tool") || classes.includes("action")) return "tool";

        // Check parent
        const parent = el.closest('[data-role], [class*="user"], [class*="assistant"], [class*="agent"]');
        if (parent) {
            const role = parent.getAttribute("data-role") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("assistant") || role.includes("agent")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        return "manus-agent";
    }
}
