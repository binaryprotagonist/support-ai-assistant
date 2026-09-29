import React, { useState } from "react";
import { Send, Sparkles, BookOpen, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { askQuestion, QuestionResponse } from "../../api/client.js";

interface QuestionViewProps {
  onQuestionSubmitted?: () => void;
  onNavigateToApprovals?: () => void;
}

const SUGGESTIONS = [
  "How many days of paid annual leave do full-time employees receive?",
  "What is the home office ergonomic setup stipend for remote employees?",
  "When can business class or premium economy be booked for flights?",
  "How does the company 401(k) retirement match work?",
  "What is the notice period required for voluntary resignation?"
];

export const QuestionView: React.FC<QuestionViewProps> = ({
  onQuestionSubmitted,
  onNavigateToApprovals
}) => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (qText?: string) => {
    const query = qText || question;
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await askQuestion(query);
      setResult(response);
      if (onQuestionSubmitted) onQuestionSubmitted();
    } catch (err: any) {
      setError(err.message || "Failed to submit question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "850px", margin: "0 auto" }}>
      {/* Search Input Card */}
      <div className="glass-panel" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem" }}>
          Ask a Company Policy Question
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          The assistant classifies your query, searches through 12 policy manuals via Hybrid Search + Reranking, drafts a grounded answer, and pauses at the Human Approval checkpoint.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Can I work remotely from another country and for how long?"
            disabled={loading}
            style={{
              flex: 1,
              padding: "0.85rem 1.2rem",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              color: "#fff",
              fontSize: "0.95rem",
              outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.85rem 1.5rem",
              background: "var(--accent-gradient)",
              border: "none",
              borderRadius: "var(--radius-md)",
              color: "#fff",
              fontWeight: "600",
              opacity: loading || !question.trim() ? 0.6 : 1
            }}
          >
            {loading ? <Clock className="animate-spin" size={18} /> : <Send size={18} />}
            {loading ? "Processing..." : "Submit"}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>
            Suggested Questions:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  handleSubmit(s);
                }}
                disabled={loading}
                style={{
                  background: "var(--bg-glass)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-full)",
                  padding: "0.35rem 0.85rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.8rem",
                  textAlign: "left"
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(244, 63, 94, 0.15)",
          border: "1px solid var(--accent-rose)",
          padding: "1rem 1.5rem",
          borderRadius: "var(--radius-md)",
          color: "#fecdd3",
          marginBottom: "2rem"
        }}>
          <AlertCircle size={20} color="var(--accent-rose)" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="glass-panel" style={{ padding: "2rem", border: "1px solid var(--border-highlight)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <div>
              <span style={{
                display: "inline-block",
                background: "rgba(99, 102, 241, 0.2)",
                color: "#a5b4fc",
                padding: "0.25rem 0.75rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8rem",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem"
              }}>
                Category: {result.category || "General"}
              </span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: "700" }}>Generated Response Draft</h3>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid var(--accent-amber)",
              color: "var(--accent-amber)",
              padding: "0.35rem 0.8rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.85rem",
              fontWeight: "600"
            }}>
              <Clock size={15} />
              Waiting Human Approval
            </div>
          </div>

          <div style={{
            background: "rgba(0, 0, 0, 0.35)",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            borderLeft: "4px solid var(--accent-primary)",
            marginBottom: "1.5rem",
            fontSize: "0.95rem",
            lineHeight: 1.6
          }}>
            {result.draft}
          </div>

          {/* Citations section */}
          {result.citations && result.citations.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h4 style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
                <BookOpen size={16} /> Grounded Policy Citations ({result.citations.length}):
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {result.citations.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--bg-glass)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.6rem 0.9rem",
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

          {/* Action to Human Approval */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--border-color)",
            paddingTop: "1rem"
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Thread ID: <code>{result.threadId}</code>
            </span>
            {onNavigateToApprovals && (
              <button
                onClick={onNavigateToApprovals}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  background: "var(--accent-amber)",
                  color: "#000",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "700",
                  fontSize: "0.85rem"
                }}
              >
                Go to Approvals Queue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
