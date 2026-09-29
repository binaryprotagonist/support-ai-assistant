import { env } from "../../config/env.js";

export interface Embedder {
  dimension: number;
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic Semantic Feature Hash Embedder
 * Produces unit-length dense vectors (dimension 128) based on character n-grams and token semantics.
 * Ensures zero-external-dependency execution for local benchmarks, CI, and fallback.
 */
export class LocalSemanticEmbedder implements Embedder {
  public readonly dimension: number;

  constructor(dimension = 128) {
    this.dimension = dimension;
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Unigram hash
      const h1 = this.hashString(word) % this.dimension;
      vector[h1] += 1.0;

      // Bigram hash for semantic context
      if (i > 0) {
        const bigram = `${words[i - 1]}_${word}`;
        const h2 = this.hashString(bigram) % this.dimension;
        vector[h2] += 1.5;
      }

      // Trigram character prefixes/suffixes for subword handling (e.g., "reimburs", "polic")
      if (word.length >= 4) {
        const prefix = word.substring(0, 4);
        const h3 = this.hashString(prefix) % this.dimension;
        vector[h3] += 0.8;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (const val of vector) {
      norm += val * val;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }
}

export const defaultEmbedder = new LocalSemanticEmbedder(128);
