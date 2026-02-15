// ============================================================================
// CLO — Base Interceptor
// Abstract base class for platform-specific conversation interceptors.
// ============================================================================

import type {
    LLMPlatform,
    ConversationTurn,
    CodeBlock,
    ToolCall,
    MessageRole,
} from "../../core/types";

/**
 * Abstract base class for platform interceptors.
 *
 * Each platform has its own DOM structure, API patterns, and streaming
 * protocols. Subclasses implement the platform-specific extraction logic.
 */
export abstract class BaseInterceptor {
    abstract platform: LLMPlatform;
    protected observer: MutationObserver | null = null;
    protected turnCallbacks: Array<(turn: ConversationTurn) => void> = [];
    protected turnCounter = 0;

    /**
     * Start intercepting conversation activity on this platform.
     */
    abstract start(): void;

    /**
     * Stop intercepting.
     */
    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Register a callback to be called when a new turn is captured.
     */
    onTurn(callback: (turn: ConversationTurn) => void): void {
        this.turnCallbacks.push(callback);
    }

    /**
     * Emit a captured turn to all registered callbacks.
     */
    protected emitTurn(turn: ConversationTurn): void {
        for (const cb of this.turnCallbacks) {
            cb(turn);
        }
    }

    /**
     * Create a ConversationTurn from raw extracted data.
     */
    protected createTurn(
        role: MessageRole,
        content: string,
        model?: string
    ): ConversationTurn {
        this.turnCounter++;
        return {
            id: `${this.platform}_turn_${this.turnCounter}_${Date.now()}`,
            role,
            content,
            timestamp: Date.now(),
            model,
            codeBlocks: this.extractCodeBlocks(content),
            toolCalls: [],
        };
    }

    /**
     * Extract code blocks from message content.
     */
    protected extractCodeBlocks(content: string): CodeBlock[] {
        const blocks: CodeBlock[] = [];
        const regex = /```(\w*)\n([\s\S]*?)```/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || "text",
                code: match[2].trim(),
            });
        }

        return blocks;
    }

    /**
     * Detect the current model from the page.
     * Subclasses should override with platform-specific logic.
     */
    protected detectModel(): string | undefined {
        return undefined;
    }

    /**
     * Observe DOM mutations in a specific container.
     * This is the primary method for capturing conversation updates.
     */
    protected observeContainer(
        container: Element,
        messageSelector: string,
        roleDetector: (el: Element) => MessageRole | null
    ): void {
        let lastMessageCount = container.querySelectorAll(messageSelector).length;

        this.observer = new MutationObserver(() => {
            const messages = container.querySelectorAll(messageSelector);
            if (messages.length > lastMessageCount) {
                // New messages detected
                for (let i = lastMessageCount; i < messages.length; i++) {
                    const msgEl = messages[i];
                    const role = roleDetector(msgEl);
                    if (role) {
                        const content = this.extractTextContent(msgEl);
                        if (content.trim()) {
                            const turn = this.createTurn(
                                role,
                                content,
                                this.detectModel()
                            );
                            this.emitTurn(turn);
                        }
                    }
                }
                lastMessageCount = messages.length;
            }
        });

        this.observer.observe(container, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * Extract clean text content from a DOM element.
     */
    protected extractTextContent(el: Element): string {
        // Clone to avoid modifying the actual DOM
        const clone = el.cloneNode(true) as Element;

        // Preserve code blocks
        const codeEls = clone.querySelectorAll("pre code, pre");
        for (const codeEl of codeEls) {
            const lang =
                codeEl.className
                    ?.split(" ")
                    .find((c) => c.startsWith("language-"))
                    ?.replace("language-", "") || "";
            codeEl.textContent = `\`\`\`${lang}\n${codeEl.textContent}\n\`\`\``;
        }

        return clone.textContent || "";
    }
}
