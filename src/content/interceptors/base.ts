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
     * Track content hashes of already-captured messages to avoid duplicates.
     * This is essential for re-scan on tab switch without double-counting.
     */
    private capturedHashes: Set<string> = new Set();

    /**
     * Stored references for re-scanning existing messages.
     */
    private observedContainer: Element | null = null;
    private observedSelector: string = "";
    private observedRoleDetector: ((el: Element) => MessageRole | null) | null = null;

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
     * Generate a hash for deduplication.
     * Uses role + first 200 chars of content to identify unique messages.
     */
    private hashMessage(role: MessageRole, content: string): string {
        const normalized = content.trim().slice(0, 200);
        return `${role}::${normalized}`;
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
     *
     * FIXED: Now also captures all existing messages on the page immediately,
     * using dedup hashes to avoid re-emitting the same content if re-scanned.
     */
    protected observeContainer(
        container: Element,
        messageSelector: string,
        roleDetector: (el: Element) => MessageRole | null
    ): void {
        // Store references for re-scanning later (tab switch, visibility change)
        this.observedContainer = container;
        this.observedSelector = messageSelector;
        this.observedRoleDetector = roleDetector;

        // ── Capture all EXISTING messages immediately ───────────────────────
        this.scanExistingMessages(container, messageSelector, roleDetector);

        // ── Set up observer for NEW messages going forward ──────────────────
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
                            const hash = this.hashMessage(role, content);
                            if (!this.capturedHashes.has(hash)) {
                                this.capturedHashes.add(hash);
                                const turn = this.createTurn(
                                    role,
                                    content,
                                    this.detectModel()
                                );
                                this.emitTurn(turn);
                            }
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
     * Scan and emit all existing messages currently on the page.
     * Uses content hashing to avoid duplicates on re-scan.
     */
    private scanExistingMessages(
        container: Element,
        messageSelector: string,
        roleDetector: (el: Element) => MessageRole | null
    ): void {
        const messages = container.querySelectorAll(messageSelector);
        let emitted = 0;

        for (const msgEl of messages) {
            const role = roleDetector(msgEl);
            if (role) {
                const content = this.extractTextContent(msgEl);
                if (content.trim()) {
                    const hash = this.hashMessage(role, content);
                    if (!this.capturedHashes.has(hash)) {
                        this.capturedHashes.add(hash);
                        const turn = this.createTurn(
                            role,
                            content,
                            this.detectModel()
                        );
                        this.emitTurn(turn);
                        emitted++;
                    }
                }
            }
        }

        if (emitted > 0) {
            console.log(`[CLO] Captured ${emitted} existing messages from page`);
        }
    }

    /**
     * Re-scan the page for messages.
     * Called when the tab becomes visible again or on explicit rescan request.
     * Only emits messages that haven't been captured before (dedup by hash).
     */
    rescan(): void {
        if (this.observedContainer && this.observedSelector && this.observedRoleDetector) {
            // The container reference might have gone stale (SPA navigation),
            // so verify it's still in the DOM
            if (document.contains(this.observedContainer)) {
                console.log("[CLO] Re-scanning page for messages...");
                this.scanExistingMessages(
                    this.observedContainer,
                    this.observedSelector,
                    this.observedRoleDetector
                );
            } else {
                console.log("[CLO] Container no longer in DOM, restarting interceptor...");
                this.stop();
                this.start();
            }
        }
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
