// ============================================================================
// CLO — Poe Interceptor
// Captures conversation turns from the Poe (Quora) web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class PoeInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "poe";

    start(): void {
        console.log("[CLO] Poe interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Poe uses a chat-style interface
            const container =
                document.querySelector('[class*="ChatMessages"]') ||
                document.querySelector('[class*="chat-messages"]') ||
                document.querySelector('[class*="MessageList"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="Message"], [class*="message"], [class*="ChatMessage"]',
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

        // Poe often uses "human" and "bot" in class names
        if (classes.includes("human") || classes.includes("Human") || classes.includes("user")) return "user";
        if (classes.includes("bot") || classes.includes("Bot") || classes.includes("assistant")) return "assistant";

        // Check for human/bot message containers
        const parent = el.closest('[class*="human"], [class*="Human"], [class*="bot"], [class*="Bot"]');
        if (parent) {
            const pclass = parent.className || "";
            if (pclass.includes("human") || pclass.includes("Human")) return "user";
            if (pclass.includes("bot") || pclass.includes("Bot")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        // Poe shows the bot name in the header
        const botName =
            document.querySelector('[class*="BotHeader"] [class*="name"]') ||
            document.querySelector('[class*="bot-name"]');

        if (botName?.textContent) {
            return botName.textContent.trim().toLowerCase();
        }
        return "poe-default";
    }
}
