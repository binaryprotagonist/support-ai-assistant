import { BaseProvider } from "./BaseProvider.js";
import { LLMRequest } from "../types.js";

export interface FlakyBehaviorOptions {
  rateLimitRate?: number;    // e.g. 0.25 (25% chance of HTTP 429)
  timeoutRate?: number;      // e.g. 0.15 (15% chance of timeout)
  malformedJsonRate?: number;// e.g. 0.15 (15% chance of returning non-JSON or invalid JSON)
  serverErrorRate?: number;  // e.g. 0.10 (10% chance of HTTP 500)
  defaultResponseContent?: string;
}

export class StubFlakyProvider extends BaseProvider {
  public readonly name: string;
  public readonly defaultModel = "stub-flaky-v1";
  private options: Required<FlakyBehaviorOptions>;
  public totalCalls = 0;
  public failCount = 0;
  public successCount = 0;

  constructor(name: string = "stub-flaky", options: FlakyBehaviorOptions = {}) {
    super();
    this.name = name;
    this.options = {
      rateLimitRate: options.rateLimitRate ?? 0.20,
      timeoutRate: options.timeoutRate ?? 0.15,
      malformedJsonRate: options.malformedJsonRate ?? 0.15,
      serverErrorRate: options.serverErrorRate ?? 0.05,
      defaultResponseContent: options.defaultResponseContent ?? JSON.stringify({
        answer: "According to our company policy, employees receive 25 days of annual paid leave.",
        citations: [{ chunkId: "leave-policy-chunk-1", quote: "employees receive 25 days of annual paid leave" }],
        confidence: 0.95
      })
    };
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
    this.totalCalls++;
    const roll = Math.random();

    // 1. Simulate Timeout
    if (roll < this.options.timeoutRate) {
      this.failCount++;
      // Sleep slightly longer than request timeout or trigger abort error
      await new Promise((resolve) => setTimeout(resolve, 80));
      const err: any = new Error("Gateway Timeout: Request to upstream LLM exceeded 80ms");
      err.name = "TimeoutError";
      err.status = 504;
      throw err;
    }

    // 2. Simulate HTTP 429 Rate Limit
    if (roll < this.options.timeoutRate + this.options.rateLimitRate) {
      this.failCount++;
      const err: any = new Error("Rate limit exceeded: 429 Too Many Requests");
      err.status = 429;
      throw err;
    }

    // 3. Simulate HTTP 500 Server Error
    if (roll < this.options.timeoutRate + this.options.rateLimitRate + this.options.serverErrorRate) {
      this.failCount++;
      const err: any = new Error("Internal Server Error: 500 upstream model failure");
      err.status = 500;
      throw err;
    }

    // 4. Simulate Malformed JSON / Schema mismatch
    if (roll < this.options.timeoutRate + this.options.rateLimitRate + this.options.serverErrorRate + this.options.malformedJsonRate) {
      this.failCount++;
      return {
        content: "INVALID_JSON_RESPONSE: { unclosed bracket",
        promptTokens: 45,
        completionTokens: 12,
        model: this.defaultModel
      };
    }

    // 5. Success
    this.successCount++;
    
    return {
      content: this.options.defaultResponseContent,
      promptTokens: 50,
      completionTokens: 60,
      model: this.defaultModel
    };
  }
}
