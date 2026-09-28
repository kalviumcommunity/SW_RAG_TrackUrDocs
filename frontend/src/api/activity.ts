import { api } from './client';

export interface ActivityItem {
  id: number;
  event_type: string;
  message: string;
  created_at: string;
}

export const activityApi = {
  list: (params?: { event_type?: string; limit?: number }) =>
    api.get<ActivityItem[]>('/activity', { params }).then((r) => r.data),
};
