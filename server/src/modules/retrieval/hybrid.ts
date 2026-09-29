import { DocumentChunk } from "../ingestion/chunker.js";
import { DenseRetriever, ScoredChunk } from "./dense.js";
import { BM25Retriever } from "./bm25.js";

export class HybridRetriever {
  private denseRetriever: DenseRetriever;
  private bm25Retriever: BM25Retriever;
  private rrfK: number;

  constructor(dense: DenseRetriever, bm25: BM25Retriever, rrfK = 60) {
    this.denseRetriever = dense;
    this.bm25Retriever = bm25;
    this.rrfK = rrfK;
  }

  public async retrieve(query: string, candidatePoolSize = 25, topK = 5): Promise<ScoredChunk[]> {
    // 1. Fetch top candidates from dense semantic search
    const denseResults = await this.denseRetriever.retrieve(query, candidatePoolSize);

    // 2. Fetch top candidates from BM25 lexical search
    const bm25Results = this.bm25Retriever.retrieve(query, candidatePoolSize);

    // 3. Reciprocal Rank Fusion
    const scoreMap = new Map<string, { chunk: DocumentChunk; rrfScore: number }>();

    denseResults.forEach((item, rank) => {
      const chunkId = item.chunk.chunkId;
      const rankScore = 1.0 / (this.rrfK + (rank + 1));
      if (!scoreMap.has(chunkId)) {
        scoreMap.set(chunkId, { chunk: item.chunk, rrfScore: rankScore });
      } else {
        scoreMap.get(chunkId)!.rrfScore += rankScore;
      }
    });

    bm25Results.forEach((item, rank) => {
      const chunkId = item.chunk.chunkId;
      const rankScore = 1.0 / (this.rrfK + (rank + 1));
      if (!scoreMap.has(chunkId)) {
        scoreMap.set(chunkId, { chunk: item.chunk, rrfScore: rankScore });
      } else {
        scoreMap.get(chunkId)!.rrfScore += rankScore;
      }
    });

    const fusedResults: ScoredChunk[] = Array.from(scoreMap.values())
      .map((entry) => ({
        chunk: entry.chunk,
        score: entry.rrfScore
      }))
      .sort((a, b) => b.score - a.score);

    return fusedResults.slice(0, topK);
  }
}
