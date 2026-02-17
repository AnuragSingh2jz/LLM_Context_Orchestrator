// ============================================================================
// CLO — ChatGPT Interceptor
// Captures conversation turns from the ChatGPT web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class ChatGPTInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "chatgpt";

    start(): void {
        console.log("[CLO] ChatGPT interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        // ChatGPT renders conversation in a scrollable main area
        const check = () => {
            const container = document.querySelector(
                'main [class*="react-scroll-to-bottom"]'
            ) || document.querySelector("main .flex.flex-col");

            if (container) {
                this.observeContainer(
                    container,
                    '[data-message-author-role]',
                    this.detectRole.bind(this)
                );
                // Base class now captures existing messages automatically
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    }

    private detectRole(el: Element): MessageRole | null {
        const role = el.getAttribute("data-message-author-role");
        if (role === "user") return "user";
        if (role === "assistant") return "assistant";
        if (role === "system") return "system";
        if (role === "tool") return "tool";
        return null;
    }

    protected detectModel(): string | undefined {
        // ChatGPT shows the model name in various places
        const modelEl =
            document.querySelector('[data-testid="model-switcher"] button span') ||
            document.querySelector('button[aria-label] span[class*="text"]');
        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("4o")) return "gpt-4o";
            if (text.includes("4")) return "gpt-4";
            if (text.includes("o1")) return "o1";
            if (text.includes("o3")) return "o3-mini";
            return text;
        }
        return "chatgpt-unknown";
    }
}
