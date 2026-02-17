// ============================================================================
// CLO — Platform Detection & Interceptor Registry
// Detects which LLM platform is active and returns the appropriate interceptor.
// ============================================================================

import type { LLMPlatform } from "../../core/types";
import { BaseInterceptor } from "./base";
import { ChatGPTInterceptor } from "./chatgpt";
import { ClaudeInterceptor } from "./claude";
import { GeminiInterceptor } from "./gemini";
import { GrokInterceptor } from "./grok";
import { PerplexityInterceptor } from "./perplexity";
import { DeepSeekInterceptor } from "./deepseek";
import { KimiInterceptor } from "./kimi";
import { ManusInterceptor } from "./manus";
import { CopilotInterceptor } from "./copilot";
import { YouInterceptor } from "./you";
import { PoeInterceptor } from "./poe";
import { HuggingChatInterceptor } from "./huggingchat";
import { QwenInterceptor } from "./qwen";
import { MistralInterceptor } from "./mistral";
import { CohereInterceptor } from "./cohere";

/**
 * URL patterns for platform detection.
 */
const PLATFORM_PATTERNS: Array<{
    platform: LLMPlatform;
    patterns: RegExp[];
}> = [
        {
            platform: "chatgpt",
            patterns: [/chatgpt\.com/i, /chat\.openai\.com/i],
        },
        {
            platform: "claude",
            patterns: [/claude\.ai/i],
        },
        {
            platform: "gemini",
            patterns: [/gemini\.google\.com/i],
        },
        {
            platform: "grok",
            patterns: [/grok\.x\.ai/i, /x\.com\/i\/grok/i],
        },
        {
            platform: "perplexity",
            patterns: [/perplexity\.ai/i],
        },
        {
            platform: "deepseek",
            patterns: [/chat\.deepseek\.com/i, /deepseek\.com/i],
        },
        {
            platform: "kimi",
            patterns: [/kimi\.moonshot\.cn/i, /kimi\.com/i],
        },
        {
            platform: "manus",
            patterns: [/manus\.im/i, /manus\.ai/i],
        },
        {
            platform: "copilot",
            patterns: [/copilot\.microsoft\.com/i],
        },
        {
            platform: "you",
            patterns: [/you\.com/i],
        },
        {
            platform: "poe",
            patterns: [/poe\.com/i],
        },
        {
            platform: "huggingchat",
            patterns: [/huggingface\.co\/chat/i],
        },
        {
            platform: "qwen",
            patterns: [/tongyi\.aliyun\.com/i, /qwen\.ai/i, /chat\.qwen/i],
        },
        {
            platform: "mistral",
            patterns: [/chat\.mistral\.ai/i],
        },
        {
            platform: "cohere",
            patterns: [/coral\.cohere\.com/i, /dashboard\.cohere\.com/i],
        },
    ];

/**
 * Detect which LLM platform is currently active based on the URL.
 */
export function detectPlatform(url?: string): LLMPlatform {
    const currentUrl = url || window.location.href;

    for (const { platform, patterns } of PLATFORM_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(currentUrl)) {
                return platform;
            }
        }
    }

    return "unknown";
}

/**
 * Get the appropriate interceptor for the detected platform.
 */
export function getInterceptor(
    platform: LLMPlatform
): BaseInterceptor | null {
    switch (platform) {
        case "chatgpt":
            return new ChatGPTInterceptor();
        case "claude":
            return new ClaudeInterceptor();
        case "gemini":
            return new GeminiInterceptor();
        case "grok":
            return new GrokInterceptor();
        case "perplexity":
            return new PerplexityInterceptor();
        case "deepseek":
            return new DeepSeekInterceptor();
        case "kimi":
            return new KimiInterceptor();
        case "manus":
            return new ManusInterceptor();
        case "copilot":
            return new CopilotInterceptor();
        case "you":
            return new YouInterceptor();
        case "poe":
            return new PoeInterceptor();
        case "huggingchat":
            return new HuggingChatInterceptor();
        case "qwen":
            return new QwenInterceptor();
        case "mistral":
            return new MistralInterceptor();
        case "cohere":
            return new CohereInterceptor();
        default:
            return null;
    }
}

/**
 * Check if the current page is a supported LLM platform.
 */
export function isSupportedPlatform(url?: string): boolean {
    return detectPlatform(url) !== "unknown";
}
