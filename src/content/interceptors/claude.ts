// ============================================================================
// CLO — Claude Interceptor
// Captures conversation turns from the Claude web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class ClaudeInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "claude";

    start(): void {
        console.log("[CLO] Claude interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Claude renders messages in a scrollable container
            const container =
                document.querySelector('[class*="conversation-content"]') ||
                document.querySelector('[data-testid="conversation-turn-list"]') ||
                document.querySelector("main .flex.flex-col");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="Message"], [data-testid*="message"]',
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

        // Claude uses "human" and "assistant" in class names / test IDs
        if (
            classes.includes("human") ||
            testId.includes("human") ||
            testId.includes("user")
        ) {
            return "user";
        }
        if (
            classes.includes("assistant") ||
            testId.includes("assistant") ||
            testId.includes("ai")
        ) {
            return "assistant";
        }

        // Fallback: check for avatar/icon elements
        const avatar = el.querySelector('[class*="avatar"], [class*="icon"]');
        if (avatar) {
            const avatarClass = avatar.className || "";
            if (avatarClass.includes("human") || avatarClass.includes("user"))
                return "user";
            if (avatarClass.includes("assistant") || avatarClass.includes("ai"))
                return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        // Claude shows model in the header/selector
        const modelEl =
            document.querySelector('[data-testid="model-selector"] button') ||
            document.querySelector('button[class*="model"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("opus")) return "claude-3-opus";
            if (text.includes("sonnet")) return "claude-3.5-sonnet";
            if (text.includes("haiku")) return "claude-3-haiku";
            return text;
        }
        return "claude-unknown";
    }
}
