import { z } from "zod";

export const CitationSchema = z.union([
  z.object({
    chunkId: z.string().optional().default("unknown_chunk"),
    quote: z.string().optional().default("")
  }).transform((val) => ({
    chunkId: val.chunkId || "unknown_chunk",
    quote: val.quote || ""
  })),
  z.string().transform((str) => ({
    chunkId: str,
    quote: ""
  }))
]);

export const AnswerSchema = z.object({
  answer: z.string().min(1, "Answer cannot be empty").describe("Clear, grounded answer to the user question"),
  citations: z.array(CitationSchema).default([]).describe("Citations referencing source policy chunks"),
  confidence: z.number().min(0).max(1).optional().default(0.95).describe("Confidence score between 0.0 and 1.0")
});

export const ClassificationSchema = z.object({
  category: z.string().optional().default("general").describe("Classified category of the question"),
  confidence: z.number().min(0).max(1).optional().default(0.9),
  reasoning: z.string().optional().default("Standard policy inquiry").describe("Brief explanation for why this category was assigned")
});

export const RevisionSchema = z.object({
  revisedAnswer: z.string().min(1, "Revised answer cannot be empty"),
  citations: z.array(CitationSchema).default([]),
  changesExplanation: z.string().optional().default("Updated based on feedback").describe("Summary of what was changed based on human feedback"),
  confidence: z.number().min(0).max(1).optional().default(0.95)
});

export const QueryRewriteSchema = z.object({
  standaloneQuery: z.string().describe("A standalone, search-optimized question incorporating necessary context from conversation history. If the query is already self-contained or a greeting, keep it unchanged.")
});

export type Citation = z.infer<typeof CitationSchema>;
export type AnswerOutput = z.infer<typeof AnswerSchema>;
export type ClassificationOutput = z.infer<typeof ClassificationSchema>;
export type RevisionOutput = z.infer<typeof RevisionSchema>;
export type QueryRewriteOutput = z.infer<typeof QueryRewriteSchema>;

