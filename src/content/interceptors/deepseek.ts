// ============================================================================
// CLO — DeepSeek Interceptor
// Captures conversation turns from the DeepSeek web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class DeepSeekInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "deepseek";

    start(): void {
        console.log("[CLO] DeepSeek interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // DeepSeek uses a chat container with message blocks
            const container =
                document.querySelector('[class*="chat-message-list"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('[id*="chat"]') ||
                document.querySelector("main .flex.flex-col");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="message"], [class*="chat-message"], [class*="markdown"], [data-role]',
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
        if (dataRole === "assistant" || classes.includes("assistant")) return "assistant";

        // DeepSeek often wraps messages with role indicators in parent
        const parent = el.closest('[data-role], [class*="user"], [class*="assistant"]');
        if (parent) {
            const role = parent.getAttribute("data-role") || parent.className || "";
            if (role.includes("user")) return "user";
            if (role.includes("assistant")) return "assistant";
        }

        // Check for avatar content
        const avatar = el.querySelector('[class*="avatar"], img[alt]');
        if (avatar) {
            const alt = avatar.getAttribute("alt") || "";
            const cls = avatar.className || "";
            if (alt.includes("user") || cls.includes("user")) return "user";
            if (alt.includes("DeepSeek") || alt.includes("assistant") || cls.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        const modelEl =
            document.querySelector('[class*="model-selector"]') ||
            document.querySelector('[class*="ModelSelect"]') ||
            document.querySelector('button[class*="model"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("r1")) return "deepseek-r1";
            if (text.includes("v3")) return "deepseek-v3";
            if (text.includes("v2")) return "deepseek-v2";
            if (text.includes("coder")) return "deepseek-coder";
            return text;
        }
        return "deepseek-chat";
    }
}
