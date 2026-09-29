import { describe, it, expect } from "vitest";
import path from "path";
import { runFullRetrievalBenchmark } from "../../src/modules/evaluation/retrievalEval.js";

describe("Part 2: Retrieval Benchmark - Dense vs. Hybrid vs. Hybrid + Reranker", () => {
  it("should demonstrate measurable lift in Recall@5 and MRR from hybrid search and reranking over naive dense baseline", async () => {
    const datasetPath = path.resolve(__dirname, "..", "..", "..", "evaluation", "retrieval-dataset.json");
    const docsDir = path.resolve(__dirname, "..", "..", "..", "documents");

    const report = await runFullRetrievalBenchmark(datasetPath, docsDir);

    console.log("\n==========================================================================");
    console.log("RETRIEVAL EVALUATION REPORT (28 Labeled Questions)");
    console.log("==========================================================================");
    console.table([
      {
        Configuration: "1. Naive Dense Baseline",
        "Recall@1": `${(report.dense.recallAt1 * 100).toFixed(1)}%`,
        "Recall@3": `${(report.dense.recallAt3 * 100).toFixed(1)}%`,
        "Recall@5": `${(report.dense.recallAt5 * 100).toFixed(1)}%`,
        MRR: report.dense.mrr.toFixed(4)
      },
      {
        Configuration: "2. Hybrid (Dense + BM25)",
        "Recall@1": `${(report.hybrid.recallAt1 * 100).toFixed(1)}%`,
        "Recall@3": `${(report.hybrid.recallAt3 * 100).toFixed(1)}%`,
        "Recall@5": `${(report.hybrid.recallAt5 * 100).toFixed(1)}%`,
        MRR: report.hybrid.mrr.toFixed(4)
      },
      {
        Configuration: "3. Hybrid + Reranker",
        "Recall@1": `${(report.hybridRerank.recallAt1 * 100).toFixed(1)}%`,
        "Recall@3": `${(report.hybridRerank.recallAt3 * 100).toFixed(1)}%`,
        "Recall@5": `${(report.hybridRerank.recallAt5 * 100).toFixed(1)}%`,
        MRR: report.hybridRerank.mrr.toFixed(4)
      }
    ]);

    console.log(`Measured Recall@5 Lift: +${report.lift.recallAt5LiftPct}%`);
    console.log(`Measured MRR Lift:      +${report.lift.mrrLiftPct}%`);
    console.log("==========================================================================\n");

    // Acceptance criteria: The retrieval report shows a measurable lift from hybrid search and re-ranking over the naive baseline
    expect(report.hybridRerank.recallAt5).toBeGreaterThanOrEqual(report.dense.recallAt5);
    expect(report.hybridRerank.mrr).toBeGreaterThan(report.dense.mrr);
    expect(report.hybridRerank.recallAt5).toBeGreaterThanOrEqual(0.85);
  });
});
