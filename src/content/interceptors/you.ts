// ============================================================================
// CLO — You.com Interceptor
// Captures conversation turns from the You.com chat interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class YouInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "you";

    start(): void {
        console.log("[CLO] You.com interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            const container =
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[data-testid="chat-messages"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [data-testid*="message"], [class*="chat-turn"]',
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

        if (classes.includes("user") || testId.includes("user")) return "user";
        if (classes.includes("assistant") || classes.includes("youchat") || testId.includes("assistant")) return "assistant";

        const parent = el.closest('[class*="user"], [class*="assistant"], [class*="youchat"]');
        if (parent) {
            const pclass = parent.className || "";
            if (pclass.includes("user")) return "user";
            if (pclass.includes("assistant") || pclass.includes("youchat")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl = document.querySelector('[class*="model-selector"], [data-testid="model-selector"]');
        if (modelEl?.textContent) {
            return modelEl.textContent.trim().toLowerCase();
        }
        return "you-smart";
    }
}
