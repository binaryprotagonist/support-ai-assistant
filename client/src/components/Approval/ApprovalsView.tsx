import React, { useState } from "react";
import { Check, X, BookOpen, Clock, AlertTriangle, MessageSquare, CheckCircle2 } from "lucide-react";
import { ApprovalItem, approveDraft, rejectDraft } from "../../api/client.js";

interface ApprovalsViewProps {
  approvals: ApprovalItem[];
  onRefresh: () => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ approvals, onRefresh }) => {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleApprove = async (threadId: string) => {
    try {
      setActionLoading(threadId);
      setStatusMessage(null);
      await approveDraft(threadId);
      setStatusMessage(`Draft approved and reply dispatched successfully for thread ${threadId.substring(0, 15)}...`);
      onRefresh();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (threadId: string) => {
    const feedback = feedbackMap[threadId];
    if (!feedback || !feedback.trim()) {
      alert("Please provide reviewer feedback so the AI assistant knows how to revise the draft.");
      return;
    }

    try {
      setActionLoading(threadId);
      setStatusMessage(null);
      const res = await rejectDraft(threadId, feedback);
      setStatusMessage(`Draft rejected. AI revised draft (Revision #${res.revisionCount}) generated with feedback.`);
      setFeedbackMap((prev) => ({ ...prev, [threadId]: "" }));
      onRefresh();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "800" }}>Human Approval Queue (HITL)</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Pause-and-resume workflow: Every sensitive answer requires human verification before dispatching to users.
          </p>
        </div>
        <span style={{
          background: approvals.length > 0 ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
          color: approvals.length > 0 ? "var(--accent-amber)" : "var(--accent-emerald)",
          border: `1px solid ${approvals.length > 0 ? "var(--accent-amber)" : "var(--accent-emerald)"}`,
          padding: "0.4rem 0.9rem",
          borderRadius: "var(--radius-full)",
          fontWeight: "700",
          fontSize: "0.85rem"
        }}>
          {approvals.length} Pending
        </span>
      </div>

      {statusMessage && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid var(--accent-emerald)",
          padding: "0.85rem 1.25rem",
          borderRadius: "var(--radius-md)",
          color: "#a7f3d0",
          marginBottom: "1.5rem"
        }}>
          <CheckCircle2 size={18} color="var(--accent-emerald)" />
          <span>{statusMessage}</span>
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="glass-panel" style={{ padding: "3rem", textAlign: "center" }}>
          <CheckCircle2 size={48} color="var(--accent-emerald)" style={{ margin: "0 auto 1rem auto" }} />
          <h3 style={{ fontSize: "1.15rem", fontWeight: "700", marginBottom: "0.5rem" }}>Queue is Clear!</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            No drafts are currently awaiting human review. Submit a question in the "Ask Question" tab to test the approval pipeline.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {approvals.map((item) => (
            <div
              key={item._id}
              className="glass-panel"
              style={{
                padding: "2rem",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)"
              }}
            >
              {/* Header Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "var(--accent-amber)",
                    padding: "0.2rem 0.75rem",
                    borderRadius: "var(--radius-full)",
                    fontSize: "0.8rem",
                    fontWeight: "700"
                  }}>
                    Awaiting Review
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Thread: <code>{item.threadId}</code>
                  </span>
                </div>

                <span style={{
                  background: item.revisionCount > 0 ? "rgba(236, 72, 153, 0.2)" : "rgba(99, 102, 241, 0.2)",
                  color: item.revisionCount > 0 ? "#f472b6" : "#a5b4fc",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.75rem",
                  fontWeight: "600"
                }}>
                  Revision {item.revisionCount} of 2 max
                </span>
              </div>

              {/* AI Draft Box */}
              <div style={{ marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: "700" }}>
                  AI Proposed Draft Answer:
                </span>
                <div style={{
                  marginTop: "0.4rem",
                  background: "rgba(0, 0, 0, 0.4)",
                  padding: "1.2rem",
                  borderRadius: "var(--radius-md)",
                  borderLeft: "4px solid var(--accent-amber)",
                  fontSize: "0.95rem",
                  lineHeight: 1.6
                }}>
                  {item.draft}
                </div>
              </div>

              {/* Citations */}
              {item.citations && item.citations.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: "700", marginBottom: "0.5rem" }}>
                    <BookOpen size={14} /> Verified Policy Citations ({item.citations.length}):
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {item.citations.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "var(--bg-glass)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          padding: "0.5rem 0.8rem",
                          fontSize: "0.85rem"
                        }}
                      >
                        <strong style={{ color: "var(--accent-cyan)", marginRight: "0.5rem" }}>[{c.chunkId}]</strong>
                        <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>"{c.quote}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer Feedback Input */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.4rem", color: "var(--text-secondary)" }}>
                  Reviewer Feedback (Required if requesting revision):
                </label>
                <textarea
                  value={feedbackMap[item.threadId] || ""}
                  onChange={(e) =>
                    setFeedbackMap((prev) => ({ ...prev, [item.threadId]: e.target.value }))
                  }
                  placeholder="e.g. Please clarify carryover policy deadlines or include the maximum per diem allowance."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => handleReject(item.threadId)}
                  disabled={actionLoading === item.threadId || item.revisionCount >= 2}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.6rem 1.2rem",
                    background: "rgba(244, 63, 94, 0.15)",
                    border: "1px solid var(--accent-rose)",
                    color: "#fda4af",
                    borderRadius: "var(--radius-md)",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    opacity: actionLoading === item.threadId || item.revisionCount >= 2 ? 0.5 : 1
                  }}
                >
                  <X size={16} />
                  {item.revisionCount >= 2 ? "Max Revisions Reached" : "Reject & Request Revision"}
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(item.threadId)}
                  disabled={actionLoading === item.threadId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.6rem 1.4rem",
                    background: "var(--accent-emerald)",
                    border: "none",
                    color: "#000",
                    borderRadius: "var(--radius-md)",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    opacity: actionLoading === item.threadId ? 0.6 : 1
                  }}
                >
                  <Check size={16} />
                  {actionLoading === item.threadId ? "Processing..." : "Approve & Dispatch"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
