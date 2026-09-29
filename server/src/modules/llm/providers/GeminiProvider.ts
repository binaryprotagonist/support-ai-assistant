import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./BaseProvider.js";
import { LLMRequest } from "../types.js";
import { env } from "../../../config/env.js";

export class GeminiProvider extends BaseProvider {
  public readonly name = "gemini";
  public readonly defaultModel: string;
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string, model?: string) {
    super();
    const key = apiKey || env.GEMINI_API_KEY;
    this.defaultModel = model || env.GEMINI_MODEL || "gemini-1.5-flash";

    if (key) {
      this.client = new GoogleGenerativeAI(key);
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
        throw new Error("GeminiProvider: GEMINI_API_KEY is not configured.");
      }

      const model = this.client.getGenerativeModel({
        model: this.defaultModel,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 1024,
          responseMimeType: request.responseFormat === "json" ? "application/json" : "text/plain"
        }
      });

      // Prepare system instruction and contents
      const systemMessage = request.messages.find((m) => m.role === "system");

      const userAndAssistantMessages = request.messages.filter((m) => m.role !== "system");

      const contents = userAndAssistantMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      // In case only system message was provided
      if (contents.length === 0 && systemMessage) {
        contents.push({ role: "user", parts: [{ text: systemMessage.content }] });
      }

      // Check if already aborted
      if (signal.aborted) {
        throw new Error("Request aborted before invocation");
      }

      const result = await model.generateContent({
        contents,
        systemInstruction: systemMessage ? { role: "system", parts: [{ text: systemMessage.content }] } : undefined
      });

      const response = await result.response;

      const text = response.text();

      // Extract usage metadata if available
      const usageMetadata = response.usageMetadata;
      
      const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(this.formatMessagesToPrompt(request.messages).length / 4);
      const completionTokens = usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

      return {
        content: text,
        promptTokens,
        completionTokens,
        model: this.defaultModel
      };
    } 
    finally {
      cleanup();
    }
  }
}
