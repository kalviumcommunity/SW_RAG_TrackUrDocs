import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, type User, type LoginPayload, type RegisterPayload } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('trackurdocs_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('trackurdocs_token');
  });
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('trackurdocs_token');
    localStorage.removeItem('trackurdocs_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      localStorage.setItem('trackurdocs_user', JSON.stringify(u));
    } catch {
      logout();
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (credentials: LoginPayload) => {
    const res = await authApi.login(credentials);
    localStorage.setItem('trackurdocs_token', res.access_token);
    setToken(res.access_token);
    const u = await authApi.me();
    setUser(u);
    localStorage.setItem('trackurdocs_user', JSON.stringify(u));
  };

  const register = async (payload: RegisterPayload) => {
    await authApi.register(payload);
    // Automatically log in after registration
    await login({ email: payload.email, password: payload.password });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
