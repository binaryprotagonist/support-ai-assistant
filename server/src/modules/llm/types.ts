import { z } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: "json" | "text";
  schema?: z.ZodType<any>;
  threadId?: string;
  operation?: string;
}

export interface LLMUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  provider: string;
  model: string;
}

export interface LLMResponse<T = any> {
  content: string;
  data?: T;
  usage: LLMUsageMetrics;
  attempts: number;
  fallbackUsed: boolean;
  provider: string;
  model: string;
}

export interface BudgetConfig {
  maxCostPerRequestUsd: number;
  maxTokensPerRequest: number;
}

export interface LLMProvider {
  name: string;
  defaultModel: string;
  generate(request: LLMRequest, signal?: AbortSignal): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    model: string;
  }>;
}
