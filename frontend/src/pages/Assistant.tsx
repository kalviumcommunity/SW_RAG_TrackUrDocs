import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  chatApi,
  type ChatMessageItem,
  type Citation,
  type ConversationSummary,
} from '../api/chat';
import { collectionsApi } from '../api/collections';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import {
  BotMessageSquare,
  Send,
  Plus,
  MessageSquare,
  FileText,
  ShieldCheck,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
  Loader2,
  ChevronRight,
} from 'lucide-react';

export const Assistant: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error: toastError, info } = useToast();

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [verifiedCitation, setVerifiedCitation] = useState<Citation | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all user conversations
  const { data: conversations, isLoading: convosLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.listConversations,
  });

  // Fetch collections for scope selection
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.list,
  });

  // Fetch active conversation messages
  const { data: convoDetail } = useQuery({
    queryKey: ['conversation', activeConversationId],
    queryFn: () => chatApi.getConversation(activeConversationId!),
    enabled: activeConversationId !== null,
  });

  useEffect(() => {
    if (convoDetail) {
      setMessages(convoDetail.messages);
    } else if (activeConversationId === null) {
      setMessages([]);
    }
  }, [convoDetail, activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Question cannot be empty');

      // Optimistic user message append
      const tempUserMsg: ChatMessageItem = {
        id: Date.now(),
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
        citations: [],
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      return chatApi.sendMessage({
        question: trimmed,
        conversation_id: activeConversationId,
        scope: scope,
      });
    },
    onSuccess: (data) => {
      // If it was a new conversation, set active conversation ID and invalidate list
      if (!activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // Append assistant response
      const assistantMsg: ChatMessageItem = {
        id: data.message_id,
        role: 'assistant',
        content: data.answer,
        created_at: new Date().toISOString(),
        citations: data.citations || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setQuestion('');
    },
    onError: (err) => {
      toastError(getErrorMessage(err));
    },
  });

  // Feedback Mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: number; rating: 'helpful' | 'not_helpful' }) => {
      return chatApi.submitFeedback(messageId, { rating });
    },
    onSuccess: (_, vars) => {
      setFeedbackGiven((prev) => ({ ...prev, [vars.messageId]: vars.rating }));
      info(vars.rating === 'helpful' ? 'Thank you for your feedback!' : 'Feedback recorded. We will improve.');
    },
    onError: (err) => toastError(getErrorMessage(err)),
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || sendMutation.isPending) return;
    sendMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setQuestion('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleCopy = (msgId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const samplePrompts = [
    'What is our remote work and equipment policy?',
    'How do employees submit travel expense reports?',
    'What are the confidentiality and security guidelines for enterprise data?',
    'Who approves annual leave and how many days are allotted?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xs">
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversations Sidebar */}
        <div className="w-72 bg-slate-950/70 border-r border-slate-800/80 flex flex-col shrink-0 hidden md:flex">
          <div className="p-3 border-b border-slate-800/80">
            <button
              onClick={startNewConversation}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {convosLoading ? (
              <div className="flex items-center justify-center p-6 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading history...
              </div>
            ) : conversations && conversations.length > 0 ? (
              conversations.map((c: ConversationSummary) => (
                <button
                  key={c.id}
                  onClick={() => setActiveConversationId(c.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-2.5 ${
                    activeConversationId === c.id
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{c.title}</span>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                No past conversations. Ask a question to start.
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900/30 overflow-hidden">
          {/* Chat Header */}
          <div className="h-12 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-2 font-medium text-slate-200">
              <BotMessageSquare className="w-4 h-4 text-blue-400" />
              <span>TrackUrDocs AI Assistant</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Grounded Mode
              </span>
            </div>

            {/* Scope Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">Scope:</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Enterprise Documents</option>
                {collections?.map((col) => (
                  <option key={col.id} value={`collection:${col.id}`}>
                    Collection: {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Ask TrackUrDocs AI</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Query company documents, standard operating procedures, HR handbooks, and policies.
                  Every answer is strictly retrieved and cited from uploaded files.
                </p>

                <div className="w-full space-y-2 text-left">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                    Suggested Questions
                  </p>
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuestion(p);
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{p}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Content */}
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Sources & Citations if Assistant */}
                    {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 mb-2">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Grounded Sources ({msg.citations.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.citations.map((c, i) => (
                            <div
                              key={i}
                              onClick={() => setVerifiedCitation(c)}
                              className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-300">
                                  {c.document_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                  {c.page && <span>Page {c.page}</span>}
                                  {c.section && <span className="truncate">§ {c.section}</span>}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 italic font-serif">
                                  "{c.excerpt}"
                                </p>
                              </div>
                              <div className="mt-2 pt-1 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                                <span>Relevance: {Math.round(c.score * 100)}%</span>
                                <span className="text-blue-400 font-medium group-hover:underline">
                                  Verify Source →
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assistant Footer Actions (Copy & Feedback) */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/40">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1 text-[11px] hover:text-slate-200 transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">Helpful?</span>
                          <button
                            onClick={() =>
                              feedbackMutation.mutate({ messageId: msg.id, rating: 'helpful' })
                            }
                            className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                              feedbackGiven[msg.id] === 'helpful' ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              feedbackMutation.mutate({ messageId: msg.id, rating: 'not_helpful' })
                            }
                            className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                              feedbackGiven[msg.id] === 'not_helpful' ? 'text-rose-400' : 'text-slate-400'
                            }`}
                            title="Not helpful"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* In-Flight Thinking Indicator */}
            {sendMutation.isPending && (
              <div className="flex items-start gap-3 text-slate-400 animate-pulse text-xs">
                <div className="w-7 h-7 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <BotMessageSquare className="w-4 h-4" />
                </div>
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Searching document vector indices & generating grounded answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-800/80">
            <form onSubmit={handleSend} className="relative flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your enterprise documents (Enter to send, Shift+Enter for newline)..."
                className="flex-1 max-h-32 min-h-[44px] py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
              />
              <button
                type="submit"
                disabled={!question.trim() || sendMutation.isPending}
                className="h-11 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Source Verification Modal */}
      <Modal
        isOpen={Boolean(verifiedCitation)}
        onClose={() => setVerifiedCitation(null)}
        title="Source Verification & Grounding"
        maxWidth="lg"
      >
        {verifiedCitation && (
          <div className="space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="font-semibold text-white text-sm">{verifiedCitation.document_name}</h4>
                  <p className="text-xs text-slate-400">
                    Chunk #{verifiedCitation.chunk_id}
                    {verifiedCitation.page && ` • Page ${verifiedCitation.page}`}
                    {verifiedCitation.section && ` • Section: ${verifiedCitation.section}`}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                Score: {Math.round(verifiedCitation.score * 100)}% Match
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Retrieved Source Excerpt
              </label>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300 font-serif leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                "{verifiedCitation.excerpt}"
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                All claims in the AI response were grounded in this retrieved text block.
              </span>
              <button
                onClick={() => {
                  navigate(`/documents/${verifiedCitation.document_id}`);
                  setVerifiedCitation(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
              >
                Inspect Document
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
