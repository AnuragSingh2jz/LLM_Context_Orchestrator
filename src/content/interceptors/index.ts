// ============================================================================
// CLO — Platform Detection & Interceptor Registry
// Detects which LLM platform is active and returns the appropriate interceptor.
// ============================================================================

import type { LLMPlatform } from "../../core/types";
import { BaseInterceptor } from "./base";
import { ChatGPTInterceptor } from "./chatgpt";
import { ClaudeInterceptor } from "./claude";
import { GeminiInterceptor } from "./gemini";

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
            // Grok interceptor TBD — uses base behavior for now
            console.log("[CLO] Grok interceptor not yet implemented, using generic");
            return null;
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
