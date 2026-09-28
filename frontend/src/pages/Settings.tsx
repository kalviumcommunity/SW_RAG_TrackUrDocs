import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  User,
  Shield,
  Server,
  Key,
  CheckCircle2,
  Database,
  Cpu,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();

  // Health probe
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () =>
      api.get('/../health').then((r) => r.data).catch(() => ({
        status: 'degraded',
        database: 'unreachable',
        storage: 'unreachable',
      })),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800/80">
        <h1 className="text-2xl font-bold tracking-tight text-white">System & Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Review authenticated employee identity, organizational workspace, and backend RAG infrastructure health.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <User className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Employee Profile</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Full Name
            </span>
            <span className="text-sm font-medium text-white">{user?.name}</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Work Email
            </span>
            <span className="text-sm font-medium text-white">{user?.email}</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Role
            </span>
            <span className="text-sm font-medium text-blue-400">{user?.role}</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Workspace
            </span>
            <span className="text-sm font-medium text-white">{user?.workspace || 'Default'}</span>
          </div>
        </div>
      </div>

      {/* Backend Infrastructure & Health */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <Server className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">Backend Infrastructure Status</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-300">FastAPI Server</p>
              <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {health?.status === 'healthy' ? 'Healthy (v1.0.0)' : 'Connected'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-start gap-3">
            <Database className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-300">Database Engine</p>
              <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {health?.database || 'OK'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60 flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-300">Document Storage</p>
              <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {health?.storage || 'OK'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RAG Configuration Specs */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <Key className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-semibold text-white">Enterprise Security & Compliance</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          TrackUrDocs uses stateless Bearer JWT authorization. All RAG calls to Gemini or embedding models are handled strictly on the backend. No secrets or API keys are exposed to the client.
        </p>
      </div>
    </div>
  );
};
