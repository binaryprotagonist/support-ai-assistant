import { DocumentChunk } from "../ingestion/chunker.js";
import { DenseRetriever, ScoredChunk } from "./dense.js";
import { BM25Retriever } from "./bm25.js";
import { HybridRetriever } from "./hybrid.js";
import { Reranker } from "./reranker.js";
import { runIngestion } from "../ingestion/ingest.js";

export type RetrievalMode = "dense" | "hybrid" | "hybrid_rerank";

export class RetrievalService {
  private chunks: DocumentChunk[] = [];
  private denseRetriever: DenseRetriever;
  private bm25Retriever: BM25Retriever;
  private hybridRetriever: HybridRetriever;
  private reranker: Reranker;
  private initialized: boolean = false;

  constructor(chunks: DocumentChunk[] = []) {
    this.chunks = chunks;
    this.denseRetriever = new DenseRetriever(chunks);
    this.bm25Retriever = new BM25Retriever(chunks);
    this.hybridRetriever = new HybridRetriever(this.denseRetriever, this.bm25Retriever);
    this.reranker = new Reranker();
    if (chunks.length > 0) {
      this.initialized = true;
    }
  }

  public async initialize(docsDir?: string): Promise<void> {
    if (this.initialized && this.chunks.length > 0) return;
    const result = await runIngestion(docsDir);
    this.chunks = result.chunks;
    this.denseRetriever.setChunks(this.chunks);
    this.bm25Retriever.buildIndex(this.chunks);
    this.hybridRetriever = new HybridRetriever(this.denseRetriever, this.bm25Retriever);
    this.initialized = true;
  }

  public async retrieve(
    query: string,
    mode: RetrievalMode = "hybrid_rerank",
    topK: number = 5
  ): Promise<ScoredChunk[]> {
    if (!this.initialized || this.chunks.length === 0) {
      await this.initialize();
    }

    switch (mode) {
      case "dense":
        return await this.denseRetriever.retrieve(query, topK);

      case "hybrid":
        return await this.hybridRetriever.retrieve(query, 25, topK);

      case "hybrid_rerank":
      default: {
        const hybridCandidates = await this.hybridRetriever.retrieve(query, 25, 20);
        return this.reranker.rerank(query, hybridCandidates, topK);
      }
    }
  }

  public getChunks(): DocumentChunk[] {
    return this.chunks;
  }
}

export const defaultRetrievalService = new RetrievalService();
