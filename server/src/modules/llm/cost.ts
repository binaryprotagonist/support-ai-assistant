
interface ModelPricing {
  promptCostPer1MTokens: number;
  completionCostPer1MTokens: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Gemini Models
  "gemini-1.5-flash": { promptCostPer1MTokens: 0.075, completionCostPer1MTokens: 0.30 },
  "gemini-1.5-flash-latest": { promptCostPer1MTokens: 0.075, completionCostPer1MTokens: 0.30 },
  "gemini-1.5-pro": { promptCostPer1MTokens: 1.25, completionCostPer1MTokens: 5.00 },
  "gemini-2.0-flash": { promptCostPer1MTokens: 0.10, completionCostPer1MTokens: 0.40 },

  // Grok / xAI Models
  "grok-2": { promptCostPer1MTokens: 2.00, completionCostPer1MTokens: 10.00 },
  "grok-2-latest": { promptCostPer1MTokens: 2.00, completionCostPer1MTokens: 10.00 },
  "grok-beta": { promptCostPer1MTokens: 5.00, completionCostPer1MTokens: 15.00 },

  // Default fallback
  default: { promptCostPer1MTokens: 0.50, completionCostPer1MTokens: 2.00 }
};

export function calculateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const normalizedModel = model.toLowerCase();

  const pricing = MODEL_PRICING[normalizedModel] || MODEL_PRICING.default;

  const promptCost = (promptTokens / 1_000_000) * pricing.promptCostPer1MTokens;
  
  const completionCost = (completionTokens / 1_000_000) * pricing.completionCostPer1MTokens;

  return Number((promptCost + completionCost).toFixed(6));
}
