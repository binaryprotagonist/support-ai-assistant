import { Annotation } from "@langchain/langgraph";
import { ScoredChunk } from "../retrieval/dense.js";
import { Citation } from "../llm/schemas.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface SupportStateType {
  question: string;
  history?: ChatTurn[];
  standaloneQuery?: string;
  category?: string;
  retrievedChunks: ScoredChunk[];
  draft?: string;
  citations: Citation[];
  confidence: number;
  reviewerDecision?: "approved" | "rejected";
  reviewerFeedback?: string;
  revisionCount: number;
  sent: boolean;
  threadId: string;
  isFlagged?: boolean;
  flagReason?: string;
  error?: string;
}

export const SupportState = Annotation.Root({
  question: Annotation<string>({
    reducer: (prev, next) => next ?? prev ?? "",
    default: () => ""
  }),
  history: Annotation<ChatTurn[]>({
    reducer: (prev, next) => next ?? prev ?? [],
    default: () => []
  }),
  standaloneQuery: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  category: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  retrievedChunks: Annotation<ScoredChunk[]>({
    reducer: (prev, next) => next ?? prev ?? [],
    default: () => []
  }),
  draft: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  citations: Annotation<Citation[]>({
    reducer: (prev, next) => next ?? prev ?? [],
    default: () => []
  }),
  confidence: Annotation<number>({
    reducer: (prev, next) => next ?? prev ?? 0,
    default: () => 0
  }),
  reviewerDecision: Annotation<"approved" | "rejected" | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  reviewerFeedback: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  revisionCount: Annotation<number>({
    reducer: (prev, next) => next ?? prev ?? 0,
    default: () => 0
  }),
  sent: Annotation<boolean>({
    reducer: (prev, next) => next ?? prev ?? false,
    default: () => false
  }),
  threadId: Annotation<string>({
    reducer: (prev, next) => next ?? prev ?? "",
    default: () => ""
  }),
  isFlagged: Annotation<boolean | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  flagReason: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  }),
  error: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined
  })
});
