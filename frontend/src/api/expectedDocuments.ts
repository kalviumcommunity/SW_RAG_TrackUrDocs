import { api } from './client';

export interface ExpectedDocument {
  id: number;
  name: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High';
  due_date: string | null;
  status: 'Available' | 'Missing';
}

export interface CreateExpectedPayload {
  name: string;
  category?: string;
  priority?: string;
  due_date?: string | null;
}

export const expectedDocumentsApi = {
  list: () =>
    api.get<ExpectedDocument[]>('/expected-documents').then((r) => r.data),

  create: (payload: CreateExpectedPayload) =>
    api.post<ExpectedDocument>('/expected-documents', payload).then((r) => r.data),
};
