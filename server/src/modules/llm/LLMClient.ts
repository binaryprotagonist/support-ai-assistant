import { z, ZodError } from "zod";
import { LLMProvider, LLMRequest, LLMResponse, LLMUsageMetrics, BudgetConfig } from "./types.js";
import { GeminiProvider } from "./providers/GeminiProvider.js";
import { GrokProvider } from "./providers/GrokProvider.js";
import { BudgetManager } from "./budget.js";
import { withRetry, isRetryableError } from "./retry.js";
import { calculateCostUsd } from "./cost.js";
import { LLMUsage } from "../../models/LLMUsage.js";
import mongoose from "mongoose";

export interface LLMClientConfig {
  primaryProvider?: LLMProvider;
  fallbackProvider?: LLMProvider;
  budgetConfig?: Partial<BudgetConfig>;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class LLMClient {
  private primaryProvider: LLMProvider;
  private fallbackProvider?: LLMProvider;
  private budgetManager: BudgetManager;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private primaryCooldownUntil: number = 0;

  constructor(config: LLMClientConfig = {}) {
    this.primaryProvider = config.primaryProvider || new GrokProvider();
    this.fallbackProvider = config.fallbackProvider || new GeminiProvider();
    this.budgetManager = new BudgetManager(config.budgetConfig);
    this.maxRetries = config.maxRetries ?? 2;
    this.baseDelayMs = config.baseDelayMs ?? 150;
    this.maxDelayMs = config.maxDelayMs ?? 2000;
  }

  public async generateStructured<T>(
    request: LLMRequest & { schema: z.ZodType<T> }
  ): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    let totalAttempts = 0;
    let fallbackUsed = false;
    let activeProvider = this.primaryProvider;

    // 1. Pre-request budget check
    const estimatedInputTokens = Math.ceil(request.messages.reduce((acc, m) => acc + m.content.length, 0) / 4);

    this.budgetManager.validatePreRequest(estimatedInputTokens);

    const callProviderWithSchema = async (provider: LLMProvider): Promise<{
      content: string;
      data: T;
      promptTokens: number;
      completionTokens: number;
      model: string;
    }> => {
      return withRetry(
        async (attempt) => {
          totalAttempts++;

          // Call provider
          const result = await provider.generate({
            ...request,
            responseFormat: "json"
          });

          // Parse JSON with auto-healing
          let parsedJson: any;
          try {
            // Strip markdown code fences if model returned json
            const cleanContent = result.content
              .replace(/```(?:json)?/gi, "")
              .replace(/```/g, "")
              .trim();

            parsedJson = JSON.parse(cleanContent);
          }
          catch (jsonErr: any) {
            // If model returned plain text instead of JSON, gracefully wrap it
            if (result.content && result.content.trim()) {
              parsedJson = {
                answer: result.content.trim(),
                revisedAnswer: result.content.trim(),
                category: "general",
                citations: []
              };
            } else {
              const parseError = new Error(`Malformed JSON received from ${provider.name}: ${jsonErr.message}`);
              parseError.name = "SyntaxError";
              throw parseError;
            }
          }

          // Auto-heal common LLM key deviations before Zod schema validation
          if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
            if (!parsedJson.answer) {
              parsedJson.answer =
                parsedJson.response ||
                parsedJson.reply ||
                parsedJson.text ||
                parsedJson.message ||
                parsedJson.content ||
                parsedJson.output ||
                parsedJson.result ||
                parsedJson.revisedAnswer;
            }

            if (!parsedJson.revisedAnswer) {
              parsedJson.revisedAnswer =
                parsedJson.answer ||
                parsedJson.revised_answer ||
                parsedJson.revision ||
                parsedJson.response;
            }

            if (!parsedJson.category) {
              parsedJson.category =
                parsedJson.classification ||
                parsedJson.type ||
                parsedJson.topic ||
                "general";
            }

            if (!Array.isArray(parsedJson.citations)) {
              if (parsedJson.citations && typeof parsedJson.citations === "string") {
                parsedJson.citations = [{ chunkId: parsedJson.citations, quote: "" }];
              } else if (Array.isArray(parsedJson.sources)) {
                parsedJson.citations = parsedJson.sources.map((s: any) =>
                  typeof s === "string" ? { chunkId: s, quote: "" } : { chunkId: s?.chunkId || s?.id || "unknown", quote: s?.quote || "" }
                );
              } else {
                parsedJson.citations = [];
              }
            }

            if (typeof parsedJson.confidence !== "number") {
              parsedJson.confidence = 0.95;
            }
          } else if (typeof parsedJson === "string") {
            parsedJson = {
              answer: parsedJson,
              revisedAnswer: parsedJson,
              category: "general",
              citations: [],
              confidence: 0.95
            };
          }

          // Validate against Zod schema
          const validationResult = request.schema.safeParse(parsedJson);

          if (!validationResult.success) {
            const schemaErr = new Error(`Schema validation failed: ${JSON.stringify(validationResult.error.format())}`);
            schemaErr.name = "ZodError";
            throw schemaErr;
          }

          return {
            content: result.content,
            data: validationResult.data,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            model: result.model
          };
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs
        }
      );
    };

    let executionResult: any;

    const isPrimaryAvailable = Date.now() >= this.primaryCooldownUntil;

    if (isPrimaryAvailable) {
      try {
        executionResult = await callProviderWithSchema(this.primaryProvider);
      }
      catch (primaryError: any) {
        console.warn(`[LLMClient] Primary provider (${this.primaryProvider.name}) failed:`, primaryError.message);

        if (
          primaryError.message?.includes("quota") ||
          primaryError.message?.includes("Quota exceeded") ||
          primaryError.message?.includes("503") ||
          primaryError.message?.includes("404") ||
          primaryError.message?.includes("401") ||
          primaryError.message?.includes("400") ||
          primaryError.message?.includes("API key") ||
          primaryError.message?.includes("invalid_api_key") ||
          primaryError.message?.includes("Incorrect API key") ||
          primaryError.message?.includes("not found") ||
          primaryError.message?.includes("no longer available") ||
          primaryError.message?.includes("free_tier_requests")
        ) {
          this.primaryCooldownUntil = Date.now() + 300_000;
        }

        if (this.fallbackProvider) {
          console.log(`[LLMClient] Initiating fallback to secondary provider (${this.fallbackProvider.name})...`);
          fallbackUsed = true;
          activeProvider = this.fallbackProvider;

          try {
            executionResult = await callProviderWithSchema(this.fallbackProvider);
          }
          catch (fallbackError: any) {
            console.error(`[LLMClient] Fallback provider (${this.fallbackProvider.name}) also failed:`, fallbackError.message);
            throw fallbackError;
          }
        }
        else {
          throw primaryError;
        }
      }
    }
    else if (this.fallbackProvider) {
      fallbackUsed = true;
      activeProvider = this.fallbackProvider;

      try {
        executionResult = await callProviderWithSchema(this.fallbackProvider);
      }
      catch (fallbackError: any) {
        console.error(`[LLMClient] Fallback provider (${this.fallbackProvider.name}) failed during cooldown:`, fallbackError.message);
        throw fallbackError;
      }
    }
    else {
      executionResult = await callProviderWithSchema(this.primaryProvider);
    }

    const latencyMs = Date.now() - startTime;
    const totalTokens = executionResult.promptTokens + executionResult.completionTokens;
    const costUsd = calculateCostUsd(executionResult.model, executionResult.promptTokens, executionResult.completionTokens);

    // 2. Post-request budget check
    this.budgetManager.validatePostRequest(totalTokens, costUsd);

    const usage: LLMUsageMetrics = {
      promptTokens: executionResult.promptTokens,
      completionTokens: executionResult.completionTokens,
      totalTokens,
      costUsd,
      latencyMs,
      provider: activeProvider.name,
      model: executionResult.model
    };

    // 3. Persist usage audit asynchronously if MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      LLMUsage.create({
        threadId: request.threadId,
        provider: usage.provider,
        model: usage.model,
        operation: request.operation || "structured_generation",
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUsd: usage.costUsd,
        latencyMs: usage.latencyMs,
        success: true
      }).catch((dbErr) => console.warn("[LLMClient] Failed to log usage to DB:", dbErr.message));
    }

    return {
      content: executionResult.content,
      data: executionResult.data,
      usage,
      attempts: totalAttempts,
      fallbackUsed,
      provider: activeProvider.name,
      model: executionResult.model
    };
  }

  public async generateText(request: LLMRequest): Promise<LLMResponse<string>> {
    const startTime = Date.now();
    let totalAttempts = 0;
    let fallbackUsed = false;
    let activeProvider = this.primaryProvider;

    const callProvider = async (provider: LLMProvider) => {
      return withRetry(
        async () => {
          totalAttempts++;
          return await provider.generate(request);
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs
        }
      );
    };

    let result: any;
    try {
      result = await callProvider(this.primaryProvider);
    }
    catch (err: any) {
      if (this.fallbackProvider) {
        fallbackUsed = true;
        activeProvider = this.fallbackProvider;
        result = await callProvider(this.fallbackProvider);
      } 
      else {
        throw err;
      }
    }

    const latencyMs = Date.now() - startTime;
    const totalTokens = result.promptTokens + result.completionTokens;
    const costUsd = calculateCostUsd(result.model, result.promptTokens, result.completionTokens);

    this.budgetManager.validatePostRequest(totalTokens, costUsd);

    const usage: LLMUsageMetrics = {
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens,
      costUsd,
      latencyMs,
      provider: activeProvider.name,
      model: result.model
    };

    return {
      content: result.content,
      data: result.content,
      usage,
      attempts: totalAttempts,
      fallbackUsed,
      provider: activeProvider.name,
      model: result.model
    };
  }
}
