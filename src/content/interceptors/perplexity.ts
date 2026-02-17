// ============================================================================
// CLO — Perplexity AI Interceptor
// Captures conversation turns from the Perplexity web interface.
// ============================================================================

import type { LLMPlatform, MessageRole } from "../../core/types";
import { BaseInterceptor } from "./base";

export class PerplexityInterceptor extends BaseInterceptor {
    platform: LLMPlatform = "perplexity";

    start(): void {
        console.log("[CLO] Perplexity interceptor started");
        this.waitForConversationContainer();
    }

    private waitForConversationContainer(): void {
        const check = () => {
            // Perplexity uses a main scrollable conversation area
            const container =
                document.querySelector('[class*="ConversationMessages"]') ||
                document.querySelector('[class*="conversation"]') ||
                document.querySelector('main [class*="flex"][class*="col"]') ||
                document.querySelector("main");

            if (container) {
                this.observeContainer(
                    container,
                    '[class*="Message"], [class*="message-content"], [class*="prose"], [data-testid*="message"]',
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
        const html = el.innerHTML || "";
        const testId = el.getAttribute("data-testid") || "";

        // Check for user query indicators
        if (
            classes.includes("user") ||
            classes.includes("query") ||
            classes.includes("UserMessage") ||
            testId.includes("user")
        ) {
            return "user";
        }

        // Check for assistant/answer indicators
        if (
            classes.includes("answer") ||
            classes.includes("assistant") ||
            classes.includes("AssistantMessage") ||
            classes.includes("prose") ||
            testId.includes("assistant") ||
            testId.includes("answer")
        ) {
            return "assistant";
        }

        // Fallback: check parent structure
        const parent = el.closest('[class*="user"], [class*="answer"], [class*="query"], [class*="assistant"]');
        if (parent) {
            const parentClass = parent.className || "";
            if (parentClass.includes("user") || parentClass.includes("query")) return "user";
            if (parentClass.includes("answer") || parentClass.includes("assistant")) return "assistant";
        }

        return null;
    }

    protected detectModel(): string | undefined {
        // Perplexity shows model selection in a dropdown/button
        const modelEl =
            document.querySelector('[class*="ModelSelector"] button') ||
            document.querySelector('[data-testid="model-selector"]') ||
            document.querySelector('button[class*="model"]');

        if (modelEl?.textContent) {
            const text = modelEl.textContent.trim().toLowerCase();
            if (text.includes("sonar")) return "perplexity-sonar";
            if (text.includes("claude")) return "claude-via-perplexity";
            if (text.includes("gpt")) return "gpt-via-perplexity";
            if (text.includes("pro")) return "perplexity-pro";
            return text;
        }
        return "perplexity-default";
    }
}
