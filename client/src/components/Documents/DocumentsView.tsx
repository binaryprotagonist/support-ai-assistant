import React from "react";
import { PolicyDocument } from "../../api/client.js";
import { FileText, Layers, CheckCircle2 } from "lucide-react";

interface DocumentsViewProps {
  documents: PolicyDocument[];
  totalChunks: number;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ documents, totalChunks }) => {
  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "800" }}>Indexed Policy Knowledge Base</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            12 authoritative corporate policy documents parsed with structure-aware chunking into dense vectors & BM25 indices.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <span style={{
            background: "rgba(16, 185, 129, 0.15)",
            color: "var(--accent-emerald)",
            padding: "0.4rem 0.9rem",
            borderRadius: "var(--radius-full)",
            fontWeight: "700",
            fontSize: "0.85rem"
          }}>
            {documents.length} Documents
          </span>
          <span style={{
            background: "rgba(99, 102, 241, 0.15)",
            color: "var(--accent-primary)",
            padding: "0.4rem 0.9rem",
            borderRadius: "var(--radius-full)",
            fontWeight: "700",
            fontSize: "0.85rem"
          }}>
            {totalChunks} Chunks Indexed
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "1.25rem" }}>
        {documents.map((doc) => (
          <div
            key={doc._id}
            className="glass-panel"
            style={{
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "var(--accent-primary)",
                  padding: "0.4rem",
                  borderRadius: "8px"
                }}>
                  <FileText size={20} />
                </div>
                <span style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "var(--accent-emerald)",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "var(--radius-full)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem"
                }}>
                  <CheckCircle2 size={12} /> {doc.status}
                </span>
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "0.35rem" }}>
                {doc.title}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontFamily: "var(--font-mono)", marginBottom: "0.75rem" }}>
                {doc.filename}
              </p>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--border-color)",
              paddingTop: "0.75rem",
              fontSize: "0.8rem",
              color: "var(--text-secondary)"
            }}>
              <span style={{ textTransform: "capitalize" }}>
                {doc.category.replace(/_/g, " ")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--accent-cyan)" }}>
                <Layers size={14} /> {doc.chunkCount} Chunks
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
