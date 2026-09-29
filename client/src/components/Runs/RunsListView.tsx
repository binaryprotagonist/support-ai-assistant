import React from "react";
import { WorkflowRunItem } from "../../api/client.js";
import { Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface RunsListViewProps {
  runs: WorkflowRunItem[];
  onRefresh: () => void;
}

export const RunsListView: React.FC<RunsListViewProps> = ({ runs, onRefresh }) => {
  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "800" }}>Workflow Runs & Trace History</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Real-time audit log of LangGraph state execution, persistent thread IDs, revision counts, and costs.
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.4rem 0.85rem",
            background: "var(--bg-glass)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-secondary)",
            fontSize: "0.85rem"
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass-panel" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "rgba(0, 0, 0, 0.3)", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "0.85rem 1rem" }}>Question</th>
              <th style={{ padding: "0.85rem 1rem" }}>Category</th>
              <th style={{ padding: "0.85rem 1rem" }}>Status</th>
              <th style={{ padding: "0.85rem 1rem" }}>Revisions</th>
              <th style={{ padding: "0.85rem 1rem" }}>Tokens / Cost</th>
              <th style={{ padding: "0.85rem 1rem" }}>Thread ID</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No workflow runs found. Ask a question to start a run!
                </td>
              </tr>
            ) : (
              runs.map((r) => {
                let badgeBg = "rgba(99, 102, 241, 0.15)";
                let badgeColor = "var(--accent-primary)";
                if (r.status === "completed") {
                  badgeBg = "rgba(16, 185, 129, 0.15)";
                  badgeColor = "var(--accent-emerald)";
                } else if (r.status === "waiting_approval") {
                  badgeBg = "rgba(245, 158, 11, 0.15)";
                  badgeColor = "var(--accent-amber)";
                }

                return (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: "600", maxWidth: "280px" }}>
                      {r.question}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>
                      <span style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem"
                      }}>
                        {r.category || "general"}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{
                        background: badgeBg,
                        color: badgeColor,
                        padding: "0.25rem 0.65rem",
                        borderRadius: "var(--radius-full)",
                        fontWeight: "700",
                        fontSize: "0.75rem",
                        textTransform: "uppercase"
                      }}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>
                      {r.revisionCount} / 2
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {r.totalTokens} tok | ${(r.estimatedCostUsd || 0).toFixed(5)}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      {r.threadId.substring(0, 16)}...
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
