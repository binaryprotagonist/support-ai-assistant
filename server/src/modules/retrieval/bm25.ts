import { DocumentChunk } from "../ingestion/chunker.js";
import { ScoredChunk } from "./dense.js";

export class BM25Retriever {
  private chunks: DocumentChunk[] = [];
  private k1: number;
  private b: number;
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private docFreqs: Map<string, number> = new Map();
  private docTermFreqs: Map<string, number>[] = [];

  constructor(chunks: DocumentChunk[] = [], k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    if (chunks.length > 0) {
      this.buildIndex(chunks);
    }
  }

  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  public buildIndex(chunks: DocumentChunk[]): void {
    this.chunks = chunks;
    const N = chunks.length;
    this.docLengths = new Array(N);
    this.docTermFreqs = new Array(N);
    this.docFreqs.clear();

    let totalLength = 0;

    for (let i = 0; i < N; i++) {
      const text = `${chunks[i].section} ${chunks[i].text}`;
      const tokens = this.tokenize(text);
      this.docLengths[i] = tokens.length;
      totalLength += tokens.length;

      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }
      this.docTermFreqs[i] = tf;

      for (const term of tf.keys()) {
        this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = N > 0 ? totalLength / N : 0;
  }

  public retrieve(query: string, topK: number = 5): ScoredChunk[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.chunks.length === 0) return [];

    const N = this.chunks.length;
    const scores: { index: number; score: number }[] = [];

    for (let i = 0; i < N; i++) {
      let score = 0;
      const tfMap = this.docTermFreqs[i];
      const docLen = this.docLengths[i];

      for (const token of queryTokens) {
        if (!tfMap.has(token)) continue;

        const tf = tfMap.get(token)!;
        const df = this.docFreqs.get(token) || 0;

        // Robertson-Spärck Jones IDF
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

        // BM25 term weight
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ index: i, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => ({
      chunk: this.chunks[s.index],
      score: s.score
    }));
  }
}
