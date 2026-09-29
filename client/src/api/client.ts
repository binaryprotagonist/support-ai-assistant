export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

export interface QuestionResponse {
  success: boolean;
  threadId: string;
  runId: string;
  status: string;
  draft?: string;
  citations?: Array<{ chunkId: string; quote: string }>;
  category?: string;
  message?: string;
}

export interface ApprovalItem {
  _id: string;
  threadId: string;
  workflowRunId?: string | {
    _id: string;
    question?: string;
    category?: string;
    confidence?: number;
    latencyMs?: number;
  };
  question?: string;
  category?: string;
  confidence?: number;
  draft: string;
  citations: Array<{ chunkId: string; quote: string }>;
  status: "pending" | "approved" | "rejected";
  feedback?: string;
  revisionCount: number;
  createdAt: string;
}

export interface PolicyDocument {
  _id: string;
  documentId: string;
  title: string;
  filename: string;
  category: string;
  chunkCount: number;
  status: string;
  uploadedAt: string;
}

export interface WorkflowRunItem {
  _id: string;
  threadId: string;
  question: string;
  status: string;
  currentStep: string;
  category?: string;
  draft?: string;
  citations?: Array<{ chunkId: string; quote: string }>;
  revisionCount: number;
  sent: boolean;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  createdAt: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/api/health"));
    return res.ok;
  } catch {
    return false;
  }
}

export async function askQuestion(
  question: string,
  threadId?: string,
  history?: ChatTurn[]
): Promise<QuestionResponse> {
  const res = await fetch(apiUrl("/api/questions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, threadId, history })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function getApprovals(): Promise<ApprovalItem[]> {
  const res = await fetch(apiUrl("/api/approvals"));
  if (!res.ok) throw new Error("Failed to fetch approvals");
  const data = await res.json();
  return data.approvals || [];
}

export async function approveDraft(threadId: string): Promise<any> {
  const res = await fetch(apiUrl(`/api/approvals/${threadId}/approve`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer: "Admin Lead" })
  });
  if (!res.ok) throw new Error("Failed to approve draft");
  return await res.json();
}

export async function rejectDraft(threadId: string, feedback: string): Promise<any> {
  const res = await fetch(apiUrl(`/api/approvals/${threadId}/reject`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, reviewer: "Admin Lead" })
  });
  if (!res.ok) throw new Error("Failed to reject draft");
  return await res.json();
}

export async function getDocuments(): Promise<{ totalDocuments: number; totalChunks: number; documents: PolicyDocument[] }> {
  const res = await fetch(apiUrl("/api/documents"));
  if (!res.ok) throw new Error("Failed to fetch documents");
  return await res.json();
}

export async function getRuns(): Promise<{ totalRuns: number; runs: WorkflowRunItem[] }> {
  const res = await fetch(apiUrl("/api/runs"));
  if (!res.ok) throw new Error("Failed to fetch runs");
  return await res.json();
}

export async function getEvaluationData(): Promise<any> {
  const res = await fetch(apiUrl("/api/evaluation"));
  if (!res.ok) throw new Error("Failed to fetch evaluation metrics");
  return await res.json();
}

export async function runEvaluation(): Promise<any> {
  const res = await fetch(apiUrl("/api/evaluation/run"), { method: "POST" });
  if (!res.ok) throw new Error("Evaluation benchmark run failed");
  return await res.json();
}

export async function runLiveEvaluation(): Promise<any> {
  const res = await fetch(apiUrl("/api/evaluation/live-run"), { method: "POST" });
  if (!res.ok) throw new Error("Live evaluation audit run failed");
  return await res.json();
}
