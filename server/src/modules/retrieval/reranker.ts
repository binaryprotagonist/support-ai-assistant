import { ScoredChunk } from "./dense.js";

export class Reranker {
  /**
   * Cross-Encoder Style Relevance Reranker
   * Evaluates deep term interaction, section relevance, and entity-level alignment
   * between query and top candidate chunks.
   */
  public rerank(query: string, candidates: ScoredChunk[], topK: number = 5): ScoredChunk[] {
    const queryTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const queryNumbers = query.match(/\b\d+\b/g) || [];

    const reranked = candidates.map(({ chunk, score: initialScore }) => {
      const sectionLower = chunk.section.toLowerCase();
      const textLower = chunk.text.toLowerCase();
      const docNameLower = chunk.documentName.toLowerCase();

      let crossScore = initialScore * 0.4;

      // 1. High-priority Section Title Match
      for (const token of queryTokens) {
        if (sectionLower.includes(token)) {
          crossScore += 0.35;
        }
        if (docNameLower.includes(token)) {
          crossScore += 0.25;
        }
      }

      // 2. Exact Phrase Match Bonus
      if (textLower.includes(query.toLowerCase().trim())) {
        crossScore += 0.50;
      }

      // 3. Exact Numbers / Thresholds Alignment
      for (const num of queryNumbers) {
        if (textLower.includes(num)) {
          crossScore += 0.40;
        }
      }

      // 4. Token Density in Text
      let matchCount = 0;
      for (const token of queryTokens) {
        if (textLower.includes(token)) {
          matchCount++;
        }
      }
      const tokenCoverage = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;
      crossScore += tokenCoverage * 0.60;

      return {
        chunk,
        score: Number(crossScore.toFixed(4))
      };
    });

    reranked.sort((a, b) => b.score - a.score);
    return reranked.slice(0, topK);
  }
}
