import { api } from './client';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; password: string; role?: string; }
export interface User { id: number; name: string; email: string; role: string; workspace: string; created_at: string; }
export interface TokenResponse { access_token: string; token_type: string; }

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>('/auth/login', payload).then(r => r.data),

  register: (payload: RegisterPayload) =>
    api.post<User>('/auth/register', payload).then(r => r.data),

  me: () =>
    api.get<User>('/auth/me').then(r => r.data),
};
