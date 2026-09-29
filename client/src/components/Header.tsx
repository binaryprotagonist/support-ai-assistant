import React from "react";
import { ShieldCheck, MessageSquare, CheckCircle, FileText, BarChart3, ListFilter, RefreshCw } from "lucide-react";

export type ActiveTab = "chat" | "approvals" | "documents" | "evaluation" | "runs";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingApprovalsCount: number;
  apiConnected: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  apiConnected,
  onRefresh
}) => {
  return (
    <header className="mb-6 font-sans">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-white text-black font-bold text-sm flex items-center justify-center shadow-sm">
            <ShieldCheck size={20} className="text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Support Assistant <span className="text-zinc-400 font-normal">Admin</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Reliable LLM Layer • Hybrid RAG • Human-in-the-Loop • Traced Eval
            </p>
          </div>
        </div>

        {/* API Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${apiConnected ? "bg-white ring-2 ring-zinc-700" : "bg-zinc-600"}`} />
            <span className="text-zinc-400">Backend:</span>
            <strong className="text-white font-medium">
              {apiConnected ? "Online" : "Connecting..."}
            </strong>
            <button
              onClick={onRefresh}
              className="text-zinc-500 hover:text-white ml-1 transition"
              title="Refresh Data"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex gap-1.5 border-b border-zinc-800 pb-2.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeTab === "chat"
              ? "bg-zinc-900 border border-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
          }`}
        >
          <MessageSquare size={14} /> Ask Question
        </button>

        <button
          onClick={() => setActiveTab("approvals")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeTab === "approvals"
              ? "bg-zinc-900 border border-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
          }`}
        >
          <CheckCircle size={14} /> Approvals
          {pendingApprovalsCount > 0 && (
            <span className="bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("runs")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeTab === "runs"
              ? "bg-zinc-900 border border-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
          }`}
        >
          <ListFilter size={14} /> Workflow Runs
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeTab === "documents"
              ? "bg-zinc-900 border border-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
          }`}
        >
          <FileText size={14} /> Policies (12 Docs)
        </button>

        <button
          onClick={() => setActiveTab("evaluation")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition ${
            activeTab === "evaluation"
              ? "bg-zinc-900 border border-zinc-700 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950"
          }`}
        >
          <BarChart3 size={14} /> Benchmarks & Evaluation
        </button>
      </nav>
    </header>
  );
};
