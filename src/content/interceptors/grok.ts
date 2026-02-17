// ============================================================================
// CLO — Grok Interceptor
// Captures conversation turns from the Grok (xAI) web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class GrokInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "grok";

    start(): void {
        console.log("[CLO] Grok interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Grok is on grok.x.ai or x.com/i/grok
            const container =
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector('[class*="message-list"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [class*="Message"], [data-testid*="message"]',
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
        const testId = el.getAttribute("data-testid") || "";

        if (
            classes.includes("user") ||
            testId.includes("user") ||
            testId.includes("human")
        ) return "user";

        if (
            classes.includes("assistant") ||
            classes.includes("grok") ||
            testId.includes("assistant") ||
            testId.includes("grok")
        ) return "assistant";

        // Check parent
        const parent = el.closest('[class*="user"], [class*="assistant"], [class*="grok"]');
        if (parent) {
            const pclass = parent.className || "";
            if (pclass.includes("user")) return "user";
            if (pclass.includes("assistant") || pclass.includes("grok")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl =
            document.querySelector('[class*="model"]') ||
            document.querySelector('[data-testid*="model"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("grok-3")) return "grok-3";
            if (text.includes("grok-2")) return "grok-2";
            return text;
        }
        return "grok-default";
    }
}
