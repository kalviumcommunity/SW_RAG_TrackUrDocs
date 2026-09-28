import { api } from './client';

export interface RecentDoc {
  id: number;
  name: string;
  file_type: string;
  status: string;
  category: string;
  updated_at: string;
}

export interface DashboardData {
  documents: number;
  collections: number;
  knowledge_coverage: number;
  recent_searches: number;
  recent_documents: RecentDoc[];
}

export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard').then((r) => r.data),
};
