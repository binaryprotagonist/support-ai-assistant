import fs from "fs/promises";
import path from "path";
import { RetrievalService, RetrievalMode } from "../retrieval/retrievalService.js";

export interface LabeledQuery {
  id: string;
  question: string;
  expectedChunkId: string;
  category: string;
}

export interface RetrievalMetrics {
  totalQueries: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number; // Mean Reciprocal Rank
}

export interface BenchmarkReport {
  dense: RetrievalMetrics;
  hybrid: RetrievalMetrics;
  hybridRerank: RetrievalMetrics;
  lift: {
    recallAt5LiftPct: number;
    mrrLiftPct: number;
  };
}

export async function evaluateRetrievalMode(
  retrievalService: RetrievalService,
  queries: LabeledQuery[],
  mode: RetrievalMode,
  topK = 5
): Promise<RetrievalMetrics> {
  let hitsAt1 = 0;
  let hitsAt3 = 0;
  let hitsAt5 = 0;
  let reciprocalRankSum = 0;

  for (const q of queries) {
    const results = await retrievalService.retrieve(q.question, mode, topK);
    const rank = results.findIndex((r) => r.chunk.chunkId === q.expectedChunkId) + 1;

    if (rank === 1) hitsAt1++;
    if (rank > 0 && rank <= 3) hitsAt3++;
    if (rank > 0 && rank <= 5) hitsAt5++;

    if (rank > 0) {
      reciprocalRankSum += 1.0 / rank;
    }
  }

  const N = queries.length;
  return {
    totalQueries: N,
    recallAt1: Number((hitsAt1 / N).toFixed(4)),
    recallAt3: Number((hitsAt3 / N).toFixed(4)),
    recallAt5: Number((hitsAt5 / N).toFixed(4)),
    mrr: Number((reciprocalRankSum / N).toFixed(4))
  };
}

export async function runFullRetrievalBenchmark(
  datasetPath?: string,
  docsDir?: string
): Promise<BenchmarkReport> {
  const filePath = datasetPath || path.resolve(process.cwd(), "..", "evaluation", "retrieval-dataset.json");
  const rawData = await fs.readFile(filePath, "utf-8");
  const queries: LabeledQuery[] = JSON.parse(rawData);

  const retrievalService = new RetrievalService();
  await retrievalService.initialize(docsDir);

  const dense = await evaluateRetrievalMode(retrievalService, queries, "dense", 5);
  const hybrid = await evaluateRetrievalMode(retrievalService, queries, "hybrid", 5);
  const hybridRerank = await evaluateRetrievalMode(retrievalService, queries, "hybrid_rerank", 5);

  const recallAt5LiftPct = Number(
    (((hybridRerank.recallAt5 - dense.recallAt5) / (dense.recallAt5 || 0.01)) * 100).toFixed(1)
  );
  const mrrLiftPct = Number(
    (((hybridRerank.mrr - dense.mrr) / (dense.mrr || 0.01)) * 100).toFixed(1)
  );

  return {
    dense,
    hybrid,
    hybridRerank,
    lift: {
      recallAt5LiftPct,
      mrrLiftPct
    }
  };
}
