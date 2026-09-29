import { describe, it, expect } from "vitest";
import { LLMClient } from "../../src/modules/llm/LLMClient.js";
import { StubFlakyProvider } from "../../src/modules/llm/providers/StubFlakyProvider.js";
import { AnswerSchema } from "../../src/modules/llm/schemas.js";
import { BudgetExceededError } from "../../src/modules/llm/budget.js";

describe("Part 1: Reliable LLM Layer - Flaky Provider & Budget Resilience", () => {
  it("should survive flaky provider failures (429s, timeouts, malformed JSON) with >=95% success across 100 calls", async () => {
    // Primary provider is deliberately flaky: ~55% failure rate per individual raw call
    const flakyPrimary = new StubFlakyProvider("flaky-primary", {
      rateLimitRate: 0.20,
      timeoutRate: 0.15,
      malformedJsonRate: 0.15,
      serverErrorRate: 0.05
    });

    // Secondary fallback provider is mildly flaky: ~15% failure rate
    const fallbackProvider = new StubFlakyProvider("fallback-provider", {
      rateLimitRate: 0.05,
      timeoutRate: 0.05,
      malformedJsonRate: 0.05,
      serverErrorRate: 0.00
    });

    const client = new LLMClient({
      primaryProvider: flakyPrimary,
      fallbackProvider: fallbackProvider,
      maxRetries: 3,
      baseDelayMs: 5,   // Fast backoff for test suite speed
      maxDelayMs: 50
    });

    let successes = 0;
    let failures = 0;
    const totalCalls = 100;

    // Run 100 calls in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < totalCalls; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, totalCalls - i) }, async (_, idx) => {
        try {
          const res = await client.generateStructured({
            messages: [{ role: "user", content: `Question ${i + idx}: What is the company leave policy?` }],
            schema: AnswerSchema
          });

          // Verify schema integrity
          if (res.data && res.data.answer && Array.isArray(res.data.citations) && typeof res.data.confidence === "number") {
            successes++;
          } else {
            failures++;
          }
        } catch (err) {
          failures++;
        }
      });

      await Promise.all(batch);
    }

    const successRate = successes / totalCalls;
    console.log(`\n======================================================`);
    console.log(`FLAKY STUB TEST RESULTS:`);
    console.log(`Total 100-request benchmark calls: ${totalCalls}`);
    console.log(`Successful valid structured completions: ${successes}`);
    console.log(`Failures: ${failures}`);
    console.log(`Observed Success Rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`Raw primary calls made: ${flakyPrimary.totalCalls} (failures: ${flakyPrimary.failCount})`);
    console.log(`Raw fallback calls made: ${fallbackProvider.totalCalls}`);
    console.log(`======================================================\n`);

    // Acceptance criteria: asserts success rate stays above 95%
    expect(successRate).toBeGreaterThanOrEqual(0.95);
  });

  it("should enforce hard per-request budget and reject requests exceeding token or cost limits", async () => {
    const provider = new StubFlakyProvider("reliable-stub", {
      rateLimitRate: 0,
      timeoutRate: 0,
      malformedJsonRate: 0,
      serverErrorRate: 0
    });

    const tightBudgetClient = new LLMClient({
      primaryProvider: provider,
      budgetConfig: {
        maxCostPerRequestUsd: 0.000001, // Extremely low budget to trigger guard
        maxTokensPerRequest: 10
      }
    });

    await expect(
      tightBudgetClient.generateStructured({
        messages: [{ role: "user", content: "A very long question that will exceed the tight token budget" }],
        schema: AnswerSchema
      })
    ).rejects.toThrow(BudgetExceededError);
  });
});
