/**
 * Chat LLM provider for dashboard agents (widget, Telegram, Discord, copilot).
 * Prefers Google Gemini direct (OpenAI-compatible endpoint). Falls back to OpenRouter.
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type LlmProvider = "gemini" | "openrouter";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  url: string;
}

/** Resolve Gemini-first, then OpenRouter. Returns null if neither key is set. */
export function getLlmConfig(): LlmConfig | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      url: GEMINI_URL,
    };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash",
      url: OPENROUTER_URL,
    };
  }

  return null;
}

export interface LlmChatRequest {
  messages: unknown[];
  tools?: unknown[];
  toolChoice?: "auto" | "none";
  maxTokens?: number;
  temperature?: number;
  /** Shown on OpenRouter only; ignored by Gemini. */
  title?: string;
}

/** POST a chat completion to the configured provider. */
export async function createLlmChatCompletion(
  config: LlmConfig,
  request: LlmChatRequest,
): Promise<Response> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    "content-type": "application/json",
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://taelprotocol.xyz";
    headers["X-Title"] = request.title ?? "Tael Agent";
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: request.messages,
    max_tokens: request.maxTokens ?? 700,
    temperature: request.temperature ?? 0.3,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
    body.tool_choice = request.toolChoice ?? "auto";
  }

  return fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
