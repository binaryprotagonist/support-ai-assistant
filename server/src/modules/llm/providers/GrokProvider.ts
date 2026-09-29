import OpenAI from "openai";
import { BaseProvider } from "./BaseProvider.js";
import { LLMRequest } from "../types.js";
import { env } from "../../../config/env.js";

export class GrokProvider extends BaseProvider {
  public readonly name = "grok";
  public readonly defaultModel: string;
  private client: OpenAI | null = null;

  constructor(apiKey?: string, model?: string, baseURL?: string) {
    super();
    const key = apiKey || env.GROK_API_KEY;
    const isGroq = key?.startsWith("gsk_");
    const defaultGroqModel = "openai/gpt-oss-120b";

    this.defaultModel = model || (isGroq ? defaultGroqModel : env.GROK_MODEL || "grok-2-latest");
    const apiBase = baseURL || (isGroq ? "https://api.groq.com/openai/v1" : env.GROK_BASE_URL || "https://api.x.ai/v1");

    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: apiBase
      });
    }
  }

  public async generate(
    request: LLMRequest,
    externalSignal?: AbortSignal
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    model: string;
  }> {
    const { signal, cleanup } = this.createTimeoutSignal(request.timeoutMs || env.REQUEST_TIMEOUT_MS, externalSignal);

    try {
      if (!this.client) {
        throw new Error("GrokProvider: GROK_API_KEY is not configured.");
      }

      let messages = request.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content
      }));

      if (request.responseFormat === "json") {
        const schemaHint =
          " Respond strictly in valid JSON format. If answering a question, use keys: {\"answer\": \"<response>\", \"citations\": [{\"chunkId\": \"<id>\", \"quote\": \"<quote>\"}]}. If categorizing, use: {\"category\": \"<category>\"}.";
        const hasJsonWord = messages.some((m) => m.content.toLowerCase().includes("json"));
        if (!hasJsonWord) {
          if (messages.length > 0 && messages[0].role === "system") {
            messages[0] = { ...messages[0], content: messages[0].content + schemaHint };
          } else {
            messages = [{ role: "system", content: "You are a helpful assistant." + schemaHint }, ...messages];
          }
        } else {
          // Append schema hint to system message to prevent missing 'answer' key
          if (messages.length > 0 && messages[0].role === "system") {
            messages[0] = { ...messages[0], content: messages[0].content + " Ensure your JSON includes the required top-level key: answer." };
          }
        }
      }

      const response = await this.client.chat.completions.create(
        {
          model: this.defaultModel,
          messages,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 1024,
          response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined
        },
        { signal }
      );

      const choice = response.choices[0];
      const content = choice?.message?.content || "";

      const promptTokens = response.usage?.prompt_tokens || Math.ceil(this.formatMessagesToPrompt(request.messages).length / 4);
      const completionTokens = response.usage?.completion_tokens || Math.ceil(content.length / 4);

      return {
        content,
        promptTokens,
        completionTokens,
        model: response.model || this.defaultModel
      };
    } finally {
      cleanup();
    }
  }
}
