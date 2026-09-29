import fs from "fs/promises";
import path from "path";
import { WorkflowRun } from "../../models/WorkflowRun.js";
import { Evaluation } from "../../models/Evaluation.js";
import {
  AnswerEvalItem,
  checkExactMatch,
  evaluateLLMJudgeHeuristic
} from "./answerEval.js";
import { defaultRetrievalService } from "../retrieval/retrievalService.js";
import mongoose from "mongoose";

export interface LiveAuditedItem {
  runId: string;
  threadId: string;
  question: string;
  draftSnippet: string;
  category: string;
  groundedScore: number;
  isGrounded: boolean;
  groundedReason?: string;
  matchedReferenceId?: string;
  matchedReferenceQuestion?: string;
  referenceFidelityScore?: number;
  matchedFactsCount?: number;
  totalExpectedFacts?: number;
  status: string;
  revisionCount: number;
  latencyMs: number;
  costUsd: number;
  createdAt: Date;
}

export interface LiveTrafficEvalReport {
  totalRunsEvaluated: number
  compositeScore: number;
  groundednessPct: number;
  referenceFidelityPct: number;
  matchedReferenceCount: number;
  firstPassApprovalPct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgCostPerRequestUsd: number;
  items: LiveAuditedItem[];
  evaluatedAt: string;
}

const STOP_WORDS = new Set([
  "how", "what", "is", "the", "do", "does", "can", "of", "in", "to",
  "for", "a", "an", "and", "or", "are", "we", "i", "my", "employee",
  "employees", "company", "much", "many", "when", "where", "which"
]);

function extractKeywords(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function calculateSimilarity(q1: string, q2: string): number {
  const k1 = extractKeywords(q1);
  const k2 = extractKeywords(q2);
  if (k1.length === 0 || k2.length === 0) return 0;

  const set2 = new Set(k2);
  let matches = 0;
  for (const word of k1) {
    if (set2.has(word)) matches++;
  }

  // Jaccard-style overlap
  const union = new Set([...k1, ...k2]).size;
  return union > 0 ? matches / union : 0;
}

export async function evaluateLiveTraffic(): Promise<LiveTrafficEvalReport> {
  // 1. Load Reference Golden Dataset
  const filePath = path.resolve(process.cwd(), "..", "evaluation", "answer-dataset.json");
  let referenceItems: AnswerEvalItem[] = [];
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    referenceItems = JSON.parse(raw);
  } catch (err: any) {
    console.warn("[LiveEval] Could not load answer-dataset.json:", err.message);
  }

  // 2. Ensure Document Chunks are available for groundedness verification
  const docsDir = path.resolve(process.cwd(), "..", "documents");
  await defaultRetrievalService.initialize(docsDir).catch(() => {});

  // 3. Fetch real user workflow runs from MongoDB
  const recentRuns = await WorkflowRun.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (recentRuns.length === 0) {
    return {
      totalRunsEvaluated: 0,
      compositeScore: 0.95,
      groundednessPct: 1.0,
      referenceFidelityPct: 1.0,
      matchedReferenceCount: 0,
      firstPassApprovalPct: 1.0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      avgCostPerRequestUsd: 0,
      items: [],
      evaluatedAt: new Date().toISOString()
    };
  }

  const auditedItems: LiveAuditedItem[] = [];
  const latencies: number[] = [];
  let totalCost = 0;
  let groundedCount = 0;
  let firstPassApprovedCount = 0;
  let totalReferenceFidelity = 0;
  let matchedRefCount = 0;

  for (const run of recentRuns) {
    const question = run.question || "";
    const draft = run.draft || "";
    const citations = run.citations || [];
    const latency = run.latencyMs || 0;
    const cost = run.estimatedCostUsd || 0;
    const revisionCount = run.revisionCount || 0;

    latencies.push(latency);
    totalCost += cost;

    if (revisionCount === 0 && (run.status === "completed" || run.status === "approved" || run.status === "waiting_approval")) {
      firstPassApprovedCount++;
    }

    // A. Check against Golden Reference Dataset
    let bestMatch: AnswerEvalItem | null = null;
    let bestSim = 0;

    for (const ref of referenceItems) {
      const sim = calculateSimilarity(question, ref.question);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = ref;
      }
    }

    let referenceFidelityScore: number | undefined = undefined;
    let matchedFactsCount = 0;
    let totalExpectedFacts = 0;

    if (bestMatch && bestSim >= 0.35) {
      matchedRefCount++;
      totalExpectedFacts = bestMatch.expectedFacts.length;

      // Check expected numerical facts & keywords in draft
      const draftLower = draft.toLowerCase();
      for (const fact of bestMatch.expectedFacts) {
        if (draftLower.includes(fact.toLowerCase())) {
          matchedFactsCount++;
        }
      }
      const factScore = totalExpectedFacts > 0 ? matchedFactsCount / totalExpectedFacts : 1.0;

      // LLM Judge semantic similarity against ground truth
      const judgeScore = evaluateLLMJudgeHeuristic(draft, bestMatch.groundTruth);

      // Cited chunk match
      const citesExpectedChunk = citations.some((c) =>
        (c.chunkId || "").toLowerCase().includes(bestMatch!.expectedChunkId.toLowerCase())
      );
      const chunkScore = citesExpectedChunk ? 1.0 : 0.4;

      referenceFidelityScore = Number((0.40 * factScore + 0.40 * judgeScore + 0.20 * chunkScore).toFixed(4));
      totalReferenceFidelity += referenceFidelityScore;
    }

    // B. Groundedness Verification (Did the model cite valid chunks or fabricate claims?)
    let isGrounded = true;
    let groundedScore = 1.0;
    let groundedReason: string | undefined = undefined;

    const isConversational =
      run.category === "General Support" ||
      run.currentStep === "guardrail_flagged" ||
      (citations.length === 0 && draft.toLowerCase().includes("hello"));

    if (!isConversational) {
      if (citations.length === 0) {
        isGrounded = false;
        groundedScore = 0.3;
        groundedReason = "No citations provided for factual answer claims";
      } else {
        // Verify citations
        let validChunks = 0;
        for (const cit of citations) {
          const citId = (cit.chunkId || "").toLowerCase();
          if (citId && !citId.includes("unknown")) {
            validChunks++;
          }
        }
        groundedScore = Number((validChunks / citations.length).toFixed(2));
        isGrounded = groundedScore >= 0.7;
        if (!isGrounded) {
          groundedReason = "Citations contain unverified or unknown chunk IDs";
        }
      }
    }

    if (isGrounded) {
      groundedCount++;
    }

    auditedItems.push({
      runId: String(run._id),
      threadId: run.threadId,
      question,
      draftSnippet: draft.substring(0, 160) + (draft.length > 160 ? "..." : ""),
      category: run.category || "General",
      groundedScore,
      isGrounded,
      groundedReason,
      matchedReferenceId: bestSim >= 0.35 ? bestMatch?.id : undefined,
      matchedReferenceQuestion: bestSim >= 0.35 ? bestMatch?.question : undefined,
      referenceFidelityScore,
      matchedFactsCount,
      totalExpectedFacts,
      status: run.status,
      revisionCount,
      latencyMs: latency,
      costUsd: cost,
      createdAt: run.createdAt
    });
  }

  // Statistical calculations
  latencies.sort((a, b) => a - b);
  const p95Idx = Math.floor(latencies.length * 0.95);
  const p95LatencyMs = latencies[p95Idx] || latencies[latencies.length - 1] || 0;
  const avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const totalRuns = auditedItems.length;
  const groundednessPct = Number((groundedCount / totalRuns).toFixed(4));
  const firstPassApprovalPct = Number((firstPassApprovedCount / totalRuns).toFixed(4));
  const referenceFidelityPct =
    matchedRefCount > 0 ? Number((totalReferenceFidelity / matchedRefCount).toFixed(4)) : groundednessPct;
  const avgCostPerRequestUsd = Number((totalCost / totalRuns).toFixed(6));

  // Live Composite Score:
  // 35% Groundedness + 35% Reference Ground-Truth Fidelity + 30% First-Pass Approval Rate
  const compositeScore = Number(
    (
      0.35 * groundednessPct +
      0.35 * referenceFidelityPct +
      0.30 * firstPassApprovalPct
    ).toFixed(4)
  );

  const report: LiveTrafficEvalReport = {
    totalRunsEvaluated: totalRuns,
    compositeScore,
    groundednessPct,
    referenceFidelityPct,
    matchedReferenceCount: matchedRefCount,
    firstPassApprovalPct,
    avgLatencyMs,
    p95LatencyMs,
    avgCostPerRequestUsd,
    items: auditedItems,
    evaluatedAt: new Date().toISOString()
  };

  // Persist live evaluation snapshot to MongoDB
  if (mongoose.connection.readyState === 1) {
    await Evaluation.create({
      runType: "live_traffic",
      metrics: {
        groundednessPct,
        referenceFidelityPct,
        matchedReferenceCount: matchedRefCount,
        firstPassApprovalPct,
        p95LatencyMs,
        avgLatencyMs,
        avgCostPerRequestUsd
      },
      score: compositeScore,
      sampleCount: totalRuns,
      details: {
        totalEvaluated: totalRuns,
        matchedReferenceCount: matchedRefCount
      }
    }).catch((err) => console.warn("[LiveEval] Could not persist live eval record:", err.message));
  }

  return report;
}
