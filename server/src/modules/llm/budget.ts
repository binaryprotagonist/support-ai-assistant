import { BudgetConfig } from "./types.js";
import { env } from "../../config/env.js";

export class BudgetExceededError extends Error {
  constructor(message: string, public readonly details: Record<string, any>) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export class BudgetManager {
  private config: BudgetConfig;

  constructor(customConfig?: Partial<BudgetConfig>) {
    this.config = {
      maxCostPerRequestUsd: customConfig?.maxCostPerRequestUsd ?? env.MAX_COST_PER_REQUEST_USD,
      maxTokensPerRequest: customConfig?.maxTokensPerRequest ?? env.MAX_TOKENS_PER_REQUEST
    };
  }

  public validatePreRequest(estimatedTokens: number): void {
    if (estimatedTokens > this.config.maxTokensPerRequest) {
      throw new BudgetExceededError(
        `Pre-request budget check failed: Estimated tokens (${estimatedTokens}) exceed hard limit (${this.config.maxTokensPerRequest})`,
        { estimatedTokens, limit: this.config.maxTokensPerRequest }
      );
    }
  }

  public validatePostRequest(totalTokens: number, costUsd: number): void {
    if (totalTokens > this.config.maxTokensPerRequest) {
      throw new BudgetExceededError(
        `Post-request budget check failed: Total tokens (${totalTokens}) exceeded limit (${this.config.maxTokensPerRequest})`,
        { totalTokens, limit: this.config.maxTokensPerRequest }
      );
    }

    if (costUsd > this.config.maxCostPerRequestUsd) {
      throw new BudgetExceededError(
        `Post-request budget check failed: Cost ($${costUsd.toFixed(4)}) exceeded limit ($${this.config.maxCostPerRequestUsd})`,
        { costUsd, limit: this.config.maxCostPerRequestUsd }
      );
    }
  }

  public getConfig(): BudgetConfig {
    return { ...this.config };
  }
}
