import { DocumentChunk } from "../ingestion/chunker.js";
import { defaultEmbedder, cosineSimilarity } from "../ingestion/embedder.js";

export interface ScoredChunk {
  chunk: DocumentChunk;
  score: number;
}

export class DenseRetriever {
  private chunks: DocumentChunk[] = [];

  constructor(chunks: DocumentChunk[] = []) {
    this.chunks = chunks;
  }

  public setChunks(chunks: DocumentChunk[]) {
    this.chunks = chunks;
  }

  public async retrieve(query: string, topK: number = 5): Promise<ScoredChunk[]> {
    if (this.chunks.length === 0) return [];

    const queryEmbedding = await defaultEmbedder.embedQuery(query);

    const scored = this.chunks.map((chunk) => {
      const score = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
