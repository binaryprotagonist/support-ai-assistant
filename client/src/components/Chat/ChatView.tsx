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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, []);

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
      textareaRef.current.style.overflowY = "hidden";
    }
    onSendMessage(text);
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    const nextHeight = Math.min(e.target.scrollHeight, 160);
    e.target.style.height = `${nextHeight}px`;
    e.target.style.overflowY = e.target.scrollHeight > 160 ? "auto" : "hidden";
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

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-canvas text-zinc-100 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="px-5 py-3.5 border-b border-zinc-700/80 bg-sidebar flex items-center justify-between shrink-0 shadow-[0_12px_30px_rgba(0,0,0,0.4),0_4px_8px_rgba(0,0,0,0.4)] z-20 relative">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-xl border border-white/[0.14] bg-white/[0.06] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
            <BookOpen size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.12] text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">
                {sessionMeta.category}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs text-zinc-400 font-normal">
                {messages.length > 0 ? `${messages.length} Messages` : "Active Consultation"}
              </span>
            </div>
            <div className="text-[15px] font-bold text-white truncate max-w-xl tracking-tight mt-0.5">
              {sessionMeta.topic}
            </div>
          </div>
        </div>

        {/* Right Header Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-xs text-zinc-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[11px] font-medium text-zinc-300">Live Policy Engine</span>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-canvas">
        {/* Subtle top fade overlay so messages don't harshly clip directly against the header border */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-canvas via-canvas/80 to-transparent pointer-events-none z-10" />

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-10 pb-8 flex flex-col scroll-smooth">
          <div className="max-w-3xl w-full mx-auto flex flex-col gap-6 pt-5">
          {messages.length === 0 ? (
            /* Welcome / Starter View (Minimalist Monochrome Workstation) */
            <div className="pt-16 pb-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-surface-elevated flex items-center justify-center font-bold text-white text-xl mb-4 shadow-sm select-none">
                A
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Aegis AI Knowledge Base
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
                    className="p-3.5 rounded-xl border border-white/[0.06] bg-surface-card hover:bg-surface-hover hover:border-white/[0.12] text-left transition duration-150 group shadow-sm"
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
                  {msg.role === "user" ? "Employee Request" : "Aegis AI"}
                </div>

                {/* Message Body */}
                <div
                  className={`text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "max-w-[80%] px-4 py-2.5 bg-surface-bubble border border-zinc-700/80 text-white rounded-xl font-sans shadow-sm"
                      : "w-full text-zinc-100 py-1"
                  }`}
                >
                  {renderFormattedContent(msg.content)}
                </div>

                {/* Assistant Footer: Sources & Actions */}
                {msg.role === "assistant" && (
                  <div className="w-full flex flex-col gap-2 mt-0">
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
                      <div className="mt-1 flex flex-col gap-1.5 pl-3 border-l border-edge">
                        {msg.citations.map((c, i) => (
                          <div
                            key={i}
                            className="text-xs bg-surface border border-white/[0.08] p-2.5 rounded-lg text-zinc-200 font-sans shadow-sm"
                          >
                            <span className="font-semibold text-white mr-2 text-xs bg-surface-elevated border border-white/[0.10] px-1.5 py-0.5 rounded font-mono">
                              {c.chunkId}
                            </span>
                            {c.quote && <span className="text-zinc-300 text-xs">"{c.quote}"</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Revision Feedback Box (if toggled) */}
                    {editingFeedbackId === msg.id && (
                      <div className="bg-surface border border-edge rounded-xl p-3.5 mt-1 flex flex-col gap-2.5 shadow-sm">
                        <div className="text-xs font-semibold text-zinc-300">
                          Request Policy Revision
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Specify the policy adjustment required..."
                          rows={2}
                          className="w-full p-2.5 rounded-lg bg-surface-input border border-edge text-xs text-white placeholder-zinc-400 resize-none font-sans focus:border-zinc-400 focus:outline-none"
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
        </div>
      </div>
    </div>

      {/* Bottom Fixed Input Box */}
      <div className="p-4 bg-sidebar border-t border-zinc-700/80 shadow-[0_-12px_36px_rgba(0,0,0,0.8),0_-4px_12px_rgba(0,0,0,0.6)] z-20 relative shrink-0">
        <div className="max-w-3xl mx-auto relative flex items-end rounded-xl border border-zinc-700 hover:border-zinc-500 bg-[#14161f] shadow-xl shadow-black/40 transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-white/10 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            placeholder="Search policies or ask workplace guidelines..."
            rows={1}
            disabled={isLoading}
            className="w-full min-h-[48px] max-h-[160px] py-3.5 pr-14 pl-4 bg-transparent text-white text-sm placeholder-zinc-400 leading-relaxed resize-none focus:outline-none font-sans overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            aria-label="Send message"
            className={`absolute right-2.5 bottom-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              inputText.trim() && !isLoading
                ? "bg-white text-black hover:bg-zinc-200 shadow cursor-pointer active:scale-95"
                : "bg-white text-zinc-800 cursor-not-allowed border border-white/[0.05]"
            }`}
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
