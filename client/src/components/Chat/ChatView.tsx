import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, BookOpen, Check, Edit3, ChevronDown, ChevronRight, Loader2, Copy } from "lucide-react";
import { rejectDraft } from "../../api/client.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ chunkId: string; quote: string }>;
  status?: "waiting_approval" | "completed" | "processing";
  threadId?: string;
  revisionCount?: number;
  timestamp: number;
}

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onUpdateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  isLoading: boolean;
  activeTitle?: string;
}

const STARTER_QUESTIONS = [
  {
    title: "Annual Paid Leave",
    query: "How many days of paid annual leave do full-time employees receive?"
  },
  {
    title: "Remote Work Stipend",
    query: "What is the home office ergonomic setup stipend for remote employees?"
  },
  {
    title: "401(k) Retirement Match",
    query: "How does the company 401(k) retirement contribution match work?"
  },
  {
    title: "Business Travel Flights",
    query: "When can business class or premium economy be booked for flights?"
  }
];

function formatBoldText(str: string) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function renderFormattedContent(text: string) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // Bullet point
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex gap-2.5 pl-2 leading-relaxed">
              <span className="text-zinc-500 shrink-0 font-mono select-none">•</span>
              <span className="text-zinc-200">{formatBoldText(content)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="m-0 leading-relaxed text-zinc-200">
            {formatBoldText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function getSessionTopic(title?: string, firstUserMsg?: string): { topic: string; category: string } {
  const query = (firstUserMsg || title || "").trim();
  const lower = query.toLowerCase();

  if (!query || lower === "new conversation") {
    return { topic: "Policy Consultation Session", category: "Knowledge Base" };
  }

  if (lower.includes("leave") || lower.includes("vacation") || lower.includes("pto") || lower.includes("annual")) {
    return { topic: "Annual Paid Leave & PTO Policy", category: "Human Resources" };
  }
  if (lower.includes("remote") || lower.includes("stipend") || lower.includes("ergonomic") || lower.includes("home office")) {
    return { topic: "Remote Work & Home Office Allowances", category: "Workplace Operations" };
  }
  if (lower.includes("401") || lower.includes("retire") || lower.includes("match") || lower.includes("pension") || lower.includes("vesting")) {
    return { topic: "401(k) Retirement Contributions & Vesting", category: "Benefits & Savings" };
  }
  if (lower.includes("travel") || lower.includes("flight") || lower.includes("hotel") || lower.includes("airfare") || lower.includes("expense")) {
    return { topic: "Corporate Travel & Expense Guidelines", category: "Finance & Travel" };
  }
  if (lower.includes("health") || lower.includes("medical") || lower.includes("dental") || lower.includes("vision") || lower.includes("insurance")) {
    return { topic: "Healthcare & Supplemental Benefits", category: "Benefits & Savings" };
  }
  if (lower.includes("conduct") || lower.includes("harass") || lower.includes("ethics") || lower.includes("compliance") || lower.includes("whistle")) {
    return { topic: "Code of Business Conduct & Ethics", category: "Legal & Compliance" };
  }
  if (lower.includes("parental") || lower.includes("maternity") || lower.includes("paternity")) {
    return { topic: "Parental & Family Care Leave Policy", category: "Human Resources" };
  }
  if (lower.includes("severance") || lower.includes("notice") || lower.includes("terminat") || lower.includes("resign")) {
    return { topic: "Separation & Notice Period Guidelines", category: "Human Resources" };
  }

  const cleaned = query.replace(/\.{2,}$/, "");
  return { topic: cleaned, category: "Policy Consultation" };
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  onUpdateMessage,
  isLoading,
  activeTitle
}) => {
  const [inputText, setInputText] = useState("");
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSendMessage(text);
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRejectWithFeedback = async (msg: ChatMessage) => {
    if (!msg.threadId || !feedbackText.trim()) return;
    try {
      setActionLoadingId(msg.id);
      const res = await rejectDraft(msg.threadId, feedbackText.trim());
      onUpdateMessage(msg.id, {
        content: res.newDraft || msg.content,
        revisionCount: res.revisionCount,
        status: "waiting_approval"
      });
      setEditingFeedbackId(null);
      setFeedbackText("");
    } catch (err: any) {
      alert(`Revision error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const firstUserMessage = messages.find((m) => m.role === "user");
  const sessionMeta = getSessionTopic(activeTitle, firstUserMessage?.content);
  const totalCitations = messages.reduce((acc, m) => acc + (m.citations?.length || 0), 0);

  return (
    <div className="flex-1 h-screen flex flex-col bg-black text-zinc-100 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="px-6 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-300 flex-shrink-0">
            <BookOpen size={14} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">
                {sessionMeta.category}
              </span>
              <span className="text-zinc-600 text-xs">/</span>
              <span className="text-xs text-zinc-400 font-normal">
                {messages.length > 0 ? `${messages.length} Messages` : "Active Consultation"}
              </span>
            </div>
            <div className="text-sm font-semibold text-white truncate max-w-xl tracking-tight">
              {sessionMeta.topic}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-medium">
              <Loader2 size={12} className="animate-spin text-white" />
              <span>Querying Hybrid Index...</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              {totalCitations > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>{totalCitations} Citations Grounded</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-medium">
                <span>Hybrid RAG</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-300">Strict Grounding</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col">
        <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
          {messages.length === 0 ? (
            /* Welcome / Starter View (Minimalist Monochrome Workstation) */
            <div className="pt-16 pb-8 text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded border border-zinc-700 bg-zinc-950 text-white font-bold text-sm flex items-center justify-center mb-5">
                //
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Internal Policy Repository
              </h1>
              <p className="text-zinc-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Authoritative queries against indexed HR, benefits, travel, and workplace compliance manuals.
              </p>

              {/* Starter Query Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {STARTER_QUESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(item.query)}
                    className="p-3.5 rounded border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700 text-left transition duration-150 group"
                  >
                    <div className="text-sm font-semibold text-zinc-200 group-hover:text-white mb-1 flex items-center justify-between">
                      <span>{item.title}</span>
                      <span className="text-zinc-600 group-hover:text-zinc-400 text-xs">→</span>
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.query}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Conversation Stream */
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${
                  msg.role === "user" ? "items-end" : "items-start w-full"
                }`}
              >
                {/* Sender label */}
                <div className="text-xs font-medium text-zinc-400 px-1">
                  {msg.role === "user" ? "Employee Request" : "Policy Assistant"}
                </div>

                {/* Message Body */}
                <div
                  className={`text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "max-w-[80%] px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-md font-sans"
                      : "w-full text-zinc-200 py-1"
                  }`}
                >
                  {renderFormattedContent(msg.content)}
                </div>

                {/* Assistant Footer: Sources & Actions */}
                {msg.role === "assistant" && (
                  <div className="w-full flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-3 text-xs">
                      {/* Sources Toggle */}
                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-medium transition"
                        >
                          <BookOpen size={13} className="text-zinc-400" />
                          <span>
                            {msg.citations.length} cited source{msg.citations.length > 1 ? "s" : ""}
                          </span>
                          {expandedSources[msg.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      )}

                      {/* Copy Action */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-medium transition"
                      >
                        {copiedId === msg.id ? <Check size={13} className="text-white" /> : <Copy size={13} />}
                        <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                      </button>

                      {/* Suggest Changes Action */}
                      {msg.threadId && (
                        <button
                          onClick={() => {
                            setEditingFeedbackId(editingFeedbackId === msg.id ? null : msg.id);
                            setFeedbackText("");
                          }}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-medium transition"
                        >
                          <Edit3 size={13} />
                          <span>Revise</span>
                        </button>
                      )}
                    </div>

                    {/* Sources Expanded Details */}
                    {expandedSources[msg.id] && msg.citations && (
                      <div className="mt-1 flex flex-col gap-1.5 pl-3 border-l border-zinc-700">
                        {msg.citations.map((c, i) => (
                          <div
                            key={i}
                            className="text-xs bg-zinc-950 border border-zinc-800 p-2.5 rounded text-zinc-300 font-sans"
                          >
                            <span className="font-semibold text-white mr-2 text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">
                              {c.chunkId}
                            </span>
                            {c.quote && <span className="text-zinc-400 text-xs">"{c.quote}"</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Revision Feedback Box (if toggled) */}
                    {editingFeedbackId === msg.id && (
                      <div className="bg-zinc-950 border border-zinc-800 rounded p-3 mt-1 flex flex-col gap-2.5">
                        <div className="text-xs font-semibold text-zinc-300">
                          Request Policy Revision
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Specify the policy adjustment required..."
                          rows={2}
                          className="w-full p-2.5 rounded bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 resize-none font-sans focus:border-zinc-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingFeedbackId(null);
                              setFeedbackText("");
                            }}
                            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRejectWithFeedback(msg)}
                            disabled={!feedbackText.trim() || actionLoadingId === msg.id}
                            className="px-3 py-1 text-xs font-medium bg-white text-black hover:bg-zinc-200 rounded disabled:opacity-40 transition"
                          >
                            {actionLoadingId === msg.id ? "Updating..." : "Submit Revision"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium py-2">
              <Loader2 size={13} className="animate-spin text-white" />
              <span>Querying policy manual vector indexes & synthesizing response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Fixed Input Box */}
      <div className="p-4 bg-black border-t border-zinc-800 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            placeholder="Search policies or ask workplace guidelines..."
            rows={1}
            disabled={isLoading}
            className="w-full min-h-[46px] max-h-[160px] py-3 pr-12 pl-3.5 rounded border border-zinc-800 bg-zinc-950 text-white text-xs placeholder-zinc-500 leading-relaxed resize-none focus:border-zinc-500 focus:outline-none font-sans"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className={`absolute right-2 bottom-2.5 w-7 h-7 rounded flex items-center justify-center transition-all ${
              inputText.trim() && !isLoading
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-zinc-900 text-zinc-600"
            }`}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
