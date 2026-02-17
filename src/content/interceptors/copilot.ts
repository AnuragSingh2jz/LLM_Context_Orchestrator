// ============================================================================
// CLO — Microsoft Copilot Interceptor
// Captures conversation turns from the Copilot web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class CopilotInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "copilot";

    start(): void {
        console.log("[CLO] Copilot interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Copilot uses a chat interface in copilot.microsoft.com
            const container =
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[class*="chat-container"]') ||
                document.querySelector('[id*="chat"]') ||
                document.querySelector("cib-serp")?.shadowRoot?.querySelector('[class*="conversation"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [class*="response"], [class*="user-message"], [class*="bot-message"]',
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
        const tag = el.tagName.toLowerCase();

        if (
            classes.includes("user") ||
            classes.includes("human") ||
            tag.includes("user")
        ) return "user";

        if (
            classes.includes("bot") ||
            classes.includes("response") ||
            classes.includes("assistant") ||
            tag.includes("bot")
        ) return "assistant";

        // Check parents
        const parent = el.closest('[class*="user"], [class*="bot"], [class*="assistant"]');
        if (parent) {
            const pclass = parent.className || "";
            if (pclass.includes("user")) return "user";
            if (pclass.includes("bot") || pclass.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        return "copilot";
    }
}
