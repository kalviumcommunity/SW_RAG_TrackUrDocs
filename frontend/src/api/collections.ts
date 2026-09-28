import { api } from './client';

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  document_count: number;
}

export interface CollectionDetail {
  id: number;
  name: string;
  description: string | null;
  documents: {
    id: number;
    name: string;
    status: string;
    category: string;
  }[];
}

export interface CreateCollectionPayload {
  name: string;
  description?: string;
}

export const collectionsApi = {
  list: () =>
    api.get<Collection[]>('/collections').then((r) => r.data),

  get: (id: number) =>
    api.get<CollectionDetail>(`/collections/${id}`).then((r) => r.data),

  create: (payload: CreateCollectionPayload) =>
    api.post<Collection>('/collections', payload).then((r) => r.data),
};
