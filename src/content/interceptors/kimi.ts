// ============================================================================
// CLO — Kimi AI Interceptor
// Captures conversation turns from the Kimi (Moonshot AI) web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class KimiInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "kimi";

    start(): void {
        console.log("[CLO] Kimi interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Kimi uses a chat container with message segments
            const container =
                document.querySelector('[class*="chat-content"]') ||
                document.querySelector('[class*="message-list"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [class*="segment"], [class*="chat-item"], [data-role]',
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

        // Check parent containers
        const parent = el.closest('[data-role], [class*="user"], [class*="assistant"], [class*="bot"]');
        if (parent) {
            const role = parent.getAttribute("data-role") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("assistant") || role.includes("bot")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl =
            document.querySelector('[class*="model-name"]') ||
            document.querySelector('[class*="ModelSelector"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("k2")) return "kimi-k2";
            if (text.includes("k1.5")) return "kimi-k1.5";
            if (text.includes("k1")) return "kimi-k1";
            return text;
        }
        return "kimi-default";
    }
}
