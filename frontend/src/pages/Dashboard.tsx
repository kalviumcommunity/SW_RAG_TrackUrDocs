import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Files,
  FolderKanban,
  BotMessageSquare,
  TrendingUp,
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium">Loading enterprise document metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/20 border border-rose-800/40 rounded-xl text-rose-200">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <h3 className="font-semibold text-base">Failed to load dashboard</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Could not communicate with the backend. Ensure FastAPI server is running on port 8000.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Indexed':
        return <Badge variant="success">Indexed</Badge>;
      case 'Processing':
        return <Badge variant="warning">Processing</Badge>;
      case 'Failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Enterprise Document Hub</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status of company knowledge base, ingestion pipeline, and RAG operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/documents?upload=true')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-500/20 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </button>
          <button
            onClick={() => navigate('/assistant')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors"
          >
            <BotMessageSquare className="w-4 h-4 text-blue-400" />
            Ask Assistant
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Documents</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Files className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{data?.documents ?? 0}</span>
            <span className="text-xs text-slate-400 ml-2">stored records</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Collections</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{data?.collections ?? 0}</span>
            <span className="text-xs text-slate-400 ml-2">department groups</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Knowledge Coverage</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold text-white">{data?.knowledge_coverage ?? 0}%</span>
              <span className="text-xs text-slate-400 ml-2">indexed & searchable</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, data?.knowledge_coverage ?? 0)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Questions Asked</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <BotMessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{data?.recent_searches ?? 0}</span>
            <span className="text-xs text-slate-400 ml-2">queries resolved</span>
          </div>
        </div>
      </div>

      {/* Recent Documents Feed */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-semibold text-white">Recently Updated Documents</h2>
          </div>
          <button
            onClick={() => navigate('/documents')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
          >
            View all documents
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {data?.recent_documents && data.recent_documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Document</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Format</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {data.recent_documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate max-w-xs">{doc.name}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{doc.category}</td>
                    <td className="py-3 px-3">
                      <span className="uppercase text-xs font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(doc.status)}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Files}
            title="No documents uploaded yet"
            description="Upload company policies, handbooks, reports, or documentation to power your AI knowledge base."
            action={{
              label: 'Upload First Document',
              onClick: () => navigate('/documents?upload=true'),
            }}
          />
        )}
      </div>
    </div>
  );
};
