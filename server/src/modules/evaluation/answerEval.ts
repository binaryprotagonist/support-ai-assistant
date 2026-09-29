import { AnswerSchema, AnswerOutput } from "../llm/schemas.js";
import { ScoredChunk } from "../retrieval/dense.js";

export interface AnswerEvalItem {
  id: string;
  question: string;
  expectedFacts: string[];
  expectedChunkId: string;
  groundTruth: string;
}

export interface EvaluationItemResult {
  id: string;
  question: string;
  exactMatchScore: number;
  schemaValid: boolean;
  groundedScore: number;
  isGrounded: boolean;
  ungroundedReason?: string;
  llmJudgeScore: number;
  latencyMs: number;
  totalTokens: number;
  costUsd: number;
}

export interface AggregateEvalReport {
  totalQuestions: number;
  exactMatchAvg: number;
  schemaValidityPct: number;
  groundednessPct: number;
  llmJudgeAvg: number;
  finalCompositeScore: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  avgCostPerRequestUsd: number;
  flaggedUngroundedCount: number;
  results: EvaluationItemResult[];
}

export function checkExactMatch(answer: string, expectedFacts: string[]): number {
  if (expectedFacts.length === 0) return 1.0;
  const answerLower = answer.toLowerCase();
  let hits = 0;

  for (const fact of expectedFacts) {
    if (answerLower.includes(fact.toLowerCase())) {
      hits++;
    }
  }

  return hits / expectedFacts.length;
}

export function checkSchemaValidity(output: any): boolean {
  return AnswerSchema.safeParse(output).success;
}

export function checkGroundedness(
  output: AnswerOutput,
  retrievedChunks: ScoredChunk[]
): { isGrounded: boolean; score: number; reason?: string } {
  // If answer has zero citations, flag as ungrounded
  if (!output.citations || output.citations.length === 0) {
    return {
      isGrounded: false,
      score: 0.0,
      reason: "FLAGGED: UNGROUNDED - No citations provided for answer claims."
    };
  }

  const retrievedChunkMap = new Map<string, string>();
  for (const item of retrievedChunks) {
    retrievedChunkMap.set(item.chunk.chunkId.toLowerCase(), item.chunk.text.toLowerCase());
  }

  let validCitations = 0;

  for (const cit of output.citations) {
    const citId = (cit.chunkId || "").toLowerCase();
    
    // Find matching chunk: exact match, or chunkId contains citId, or citId contains chunkId
    let foundChunkText: string | undefined = retrievedChunkMap.get(citId);
    if (!foundChunkText) {
      for (const [chunkId, text] of retrievedChunkMap.entries()) {
        if (chunkId.includes(citId) || citId.includes(chunkId)) {
          foundChunkText = text;
          break;
        }
      }
    }

    if (!foundChunkText) {
      // If it doesn't match any retrieved chunk
      return {
        isGrounded: false,
        score: 0.2,
        reason: `FLAGGED: UNGROUNDED - Cited chunkId "${cit.chunkId}" was not present in retrieved context.`
      };
    }

    // If quote is provided, verify partial lexical overlap; if quote omitted, chunk presence is valid
    const quoteWords = cit.quote ? cit.quote.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2) : [];
    if (quoteWords.length === 0) {
      validCitations++;
    } else {
      let matchCount = 0;
      for (const w of quoteWords) {
        if (foundChunkText.includes(w)) matchCount++;
      }
      const matchRatio = matchCount / quoteWords.length;
      if (matchRatio >= 0.3) {
        validCitations++;
      }
    }
  }

  const score = validCitations / output.citations.length;
  const isGrounded = score >= 0.7;

  return {
    isGrounded,
    score,
    reason: isGrounded ? undefined : "FLAGGED: UNGROUNDED - Citations failed quotation verification in source chunk."
  };
}

export function evaluateLLMJudgeHeuristic(answer: string, groundTruth: string): number {
  const ansLower = answer.toLowerCase();
  const gtWords = groundTruth.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);

  let hits = 0;
  for (const w of gtWords) {
    if (ansLower.includes(w)) hits++;
  }

  const lexicalOverlap = gtWords.length > 0 ? hits / gtWords.length : 0.8;
  const lengthPenalty = answer.length < 30 ? 0.4 : 1.0;

  return Math.min(1.0, Math.max(0.0, Number((lexicalOverlap * 0.8 + 0.2 * lengthPenalty).toFixed(2))));
}
