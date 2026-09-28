import { api } from './client';

export interface ChatIn {
  question: string;
  conversation_id?: number | null;
  scope?: string;
  updated_within_days?: number | null;
}

export interface Citation {
  document_id: number;
  document_name: string;
  chunk_id: number;
  page: number | null;
  section: string | null;
  score: number;
  excerpt: string;
}

export interface ChatOut {
  conversation_id: number;
  message_id: number;
  answer: string;
  grounded: boolean;
  citations: Citation[];
  suggested_followups: string[];
}

export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  citations: Citation[];
}

export interface ConversationDetail {
  id: number;
  title: string;
  messages: ChatMessageItem[];
}

export interface FeedbackPayload {
  rating: 'helpful' | 'not_helpful';
}

export const chatApi = {
  sendMessage: (payload: ChatIn) =>
    api.post<ChatOut>('/chat', payload).then((r) => r.data),

  listConversations: () =>
    api.get<ConversationSummary[]>('/chat/conversations').then((r) => r.data),

  getConversation: (id: number) =>
    api.get<ConversationDetail>(`/chat/conversations/${id}`).then((r) => r.data),

  submitFeedback: (messageId: number, payload: FeedbackPayload) =>
    api.post<{ message: string; rating: string }>(`/chat/messages/${messageId}/feedback`, payload).then((r) => r.data),
};
