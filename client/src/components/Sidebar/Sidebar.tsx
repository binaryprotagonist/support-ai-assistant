import React from "react";
import { Plus, MessageSquare, Trash2, BarChart3, Database } from "lucide-react";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  documentCount: number;
  apiConnected: boolean;
  currentRoute: "chat" | "analytics";
  onNavigateRoute: (route: "chat" | "analytics") => void;
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  documentCount,
  apiConnected,
  currentRoute,
  onNavigateRoute,
  pendingApprovalsCount
}) => {
  return (
    <aside className="w-72 h-full bg-sidebar border-r border-zinc-700/80 flex flex-col shrink-0 select-none text-zinc-300 overflow-hidden shadow-[12px_0_30px_rgba(0,0,0,0.4),4px_0_8px_rgba(0,0,0,0.4)] z-20 relative">
      {/* Brand Header */}
      <div className="px-5 py-3.5 flex items-center gap-3.5 border-b border-zinc-700/80 bg-sidebar shrink-0">
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.14] flex items-center justify-center font-bold text-white text-base shadow-sm select-none">
          A
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white tracking-tight">
              Aegis AI
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.12] text-[9px] font-semibold text-zinc-300 uppercase tracking-wider">v1.0</span>
          </div>
          <span className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
            Enterprise Knowledge Base
          </span>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-white/[0.06] hover:bg-white/[0.10] text-white text-[13px] font-semibold transition duration-150 shadow-md active:scale-[0.99]"
        >
          <Plus size={16} className="text-zinc-200" />
          <span>New conversation</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-1">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2.5 py-1.5">
          Conversations
        </div>

        {sessions.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-xs">
            No active conversations
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId && currentRoute === "chat";
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors duration-150 ${
                  isActive
                    ? "bg-white/[0.10] border border-white/[0.12] text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden pr-1">
                  <MessageSquare size={14} className={isActive ? "text-white shrink-0" : "text-zinc-500 shrink-0"} />
                  <span className="truncate text-[13px] font-semibold">{session.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-white hover:bg-white/[0.08] transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-zinc-700/80 flex flex-col gap-2.5 bg-sidebar shrink-0">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-zinc-300 font-medium text-xs">{apiConnected ? "Engine Online" : "Engine Offline"}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400 text-xs">
            <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.10] font-mono text-[10px] text-zinc-300 font-medium">{documentCount} docs</span>
          </div>
        </div>

        {/* System Analytics Navigation Link */}
        <button
          onClick={() => onNavigateRoute(currentRoute === "analytics" ? "chat" : "analytics")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition duration-150 shadow-sm ${
            currentRoute === "analytics"
              ? "bg-white/[0.12] border border-zinc-500 text-white font-semibold"
              : "border border-zinc-700 hover:border-zinc-500 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className={currentRoute === "analytics" ? "text-white" : "text-zinc-400"} />
            <span className="text-xs font-semibold">System Analytics</span>
          </div>
          {pendingApprovalsCount && pendingApprovalsCount > 0 ? (
            <span className="bg-white text-black font-bold text-[10px] px-1.5 py-0.5 rounded">
              {pendingApprovalsCount}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-400 font-mono">Ready</span>
          )}
        </button>
      </div>
    </aside>
  );
};
