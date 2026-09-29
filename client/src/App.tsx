import React, { useState, useEffect } from "react";
import { Sidebar, ChatSession } from "./components/Sidebar/Sidebar.js";
import { ChatView, ChatMessage } from "./components/Chat/ChatView.js";
import { AnalyticsDashboard } from "./components/Analytics/AnalyticsDashboard.js";
import { askQuestion, getDocuments, getApprovals, checkHealth } from "./api/client.js";

const SESSIONS_STORAGE_KEY = "company_assistant_sessions_v1";
const MESSAGES_STORAGE_KEY = "company_assistant_messages_v1";

export function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return sessions.length > 0 ? sessions[0].id : null;
  });

  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem(MESSAGES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [documentCount, setDocumentCount] = useState(12);
  const [apiConnected, setApiConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<"chat" | "analytics">(() => {
    return window.location.pathname.startsWith("/analytics") ? "analytics" : "chat";
  });
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const navigateRoute = (route: "chat" | "analytics") => {
    setCurrentRoute(route);
    const targetPath = route === "analytics" ? "/analytics" : "/";
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname.startsWith("/analytics") ? "analytics" : "chat");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Failed to persist sessions:", e);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messagesMap));
    } catch (e) {
      console.warn("Failed to persist messages:", e);
    }
  }, [messagesMap]);

  // Initial Health, Document count & Pending Approvals
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isConnected = await checkHealth();
        setApiConnected(isConnected);
        const docs = await getDocuments().catch(() => null);
        if (docs?.totalDocuments) {
          setDocumentCount(docs.totalDocuments);
        }
        const apprs = await getApprovals().catch(() => []);
        setPendingApprovalsCount(apprs.length);
      } catch {
        setApiConnected(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleNewChat = () => {
    const newId = `session_${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "New conversation",
      updatedAt: Date.now()
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    if (currentRoute !== "chat") navigateRoute("chat");
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessagesMap((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSendMessage = async (text: string) => {
    let currentSessionId = activeSessionId;

    // Create session if none active
    if (!currentSessionId) {
      const newId = `session_${Date.now()}`;
      const newSession: ChatSession = {
        id: newId,
        title: text.length > 32 ? text.substring(0, 32) + "..." : text,
        updatedAt: Date.now()
      };
      setSessions([newSession]);
      setActiveSessionId(newId);
      currentSessionId = newId;
    } else {
      // Update session title if default
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === currentSessionId && s.title === "New conversation") {
            return {
              ...s,
              title: text.length > 32 ? text.substring(0, 32) + "..." : text,
              updatedAt: Date.now()
            };
          }
          return s;
        })
      );
    }

    const previousMessages = messagesMap[currentSessionId!] || [];
    const sessionHistory = previousMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: text,
      timestamp: Date.now()
    };

    setMessagesMap((prev) => ({
      ...prev,
      [currentSessionId!]: [...(prev[currentSessionId!] || []), userMessage]
    }));

    try {
      setIsLoading(true);
      const response = await askQuestion(text, currentSessionId!, sessionHistory);

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        content: response.draft || "No response generated.",
        citations: response.citations || [],
        status: response.status as any,
        threadId: response.threadId,
        revisionCount: 0,
        timestamp: Date.now()
      };

      setMessagesMap((prev) => ({
        ...prev,
        [currentSessionId!]: [...(prev[currentSessionId!] || []), assistantMessage]
      }));
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: "assistant",
        content: `Sorry, an error occurred while searching policy manuals: ${err.message}`,
        timestamp: Date.now()
      };
      setMessagesMap((prev) => ({
        ...prev,
        [currentSessionId!]: [...(prev[currentSessionId!] || []), errorMessage]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMessage = (msgId: string, updates: Partial<ChatMessage>) => {
    if (!activeSessionId) return;
    setMessagesMap((prev) => ({
      ...prev,
      [activeSessionId]: (prev[activeSessionId] || []).map((m) =>
        m.id === msgId ? { ...m, ...updates } : m
      )
    }));
  };

  const activeMessages = activeSessionId ? messagesMap[activeSessionId] || [] : [];
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-black text-white font-sans antialiased">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          if (currentRoute !== "chat") navigateRoute("chat");
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        documentCount={documentCount}
        apiConnected={apiConnected}
        currentRoute={currentRoute}
        onNavigateRoute={navigateRoute}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {currentRoute === "analytics" ? (
        <AnalyticsDashboard 
          onBackToChat={() => navigateRoute("chat")} 
        />
      ) : (
        <ChatView
          messages={activeMessages}
          onSendMessage={handleSendMessage}
          onUpdateMessage={handleUpdateMessage}
          isLoading={isLoading}
          activeTitle={activeSession?.title}
        />
      )}
    </div>
  );
}

export default App;
