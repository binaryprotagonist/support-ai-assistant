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
    <aside className="w-64 h-screen bg-black border-r border-zinc-800 flex flex-col shrink-0 select-none text-zinc-300">
      {/* Brand Header */}
      <div className="p-4 flex items-center gap-3 border-b border-zinc-800">
        <div className="w-7 h-7 rounded bg-white text-black font-bold text-xs flex items-center justify-center shadow-sm">
          //
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white tracking-tight">
            Support Assistant
          </span>
          <span className="text-[11px] text-zinc-400">
            Internal Knowledge Base
          </span>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition duration-150"
        >
          <Plus size={14} className="text-zinc-400" />
          <span>New conversation</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-1">
        <div className="text-[11px] font-medium text-zinc-400 px-2 py-1.5">
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
                className={`group flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer border transition-colors duration-150 ${
                  isActive
                    ? "bg-zinc-900 border-zinc-700 text-white font-medium"
                    : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950 hover:border-zinc-850"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden pr-1">
                  <MessageSquare size={13} className={isActive ? "text-white shrink-0" : "text-zinc-500 shrink-0"} />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800 flex flex-col gap-2.5 bg-black">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300 font-medium">{apiConnected ? "Engine Online" : "Engine Offline"}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400">
            <span>{documentCount} docs</span>
          </div>
        </div>

        {/* System Analytics Navigation Link */}
        <button
          onClick={() => onNavigateRoute(currentRoute === "analytics" ? "chat" : "analytics")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-xs transition duration-150 ${
            currentRoute === "analytics"
              ? "bg-zinc-900 border-white text-white font-medium"
              : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-300 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className={currentRoute === "analytics" ? "text-white" : "text-zinc-400"} />
            <span className="text-xs font-medium">System Analytics</span>
          </div>
          {pendingApprovalsCount && pendingApprovalsCount > 0 ? (
            <span className="bg-white text-black font-bold text-[10px] px-1.5 py-0.5 rounded">
              {pendingApprovalsCount}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-400">v1.0</span>
          )}
        </button>
      </div>
    </aside>
  );
};
