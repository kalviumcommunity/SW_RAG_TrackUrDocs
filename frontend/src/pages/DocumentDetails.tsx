import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import {
  FileText,
  ArrowLeft,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  User,
  Sparkles,
  AlertTriangle,
  FolderKanban,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

export const DocumentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const docId = id ? parseInt(id, 10) : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: doc, isLoading, error, refetch } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsApi.get(docId),
    enabled: docId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(docId),
    onSuccess: () => {
      success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/documents');
    },
    onError: (err) => toastError(getErrorMessage(err)),
  });

  const reindexMutation = useMutation({
    mutationFn: () => documentsApi.reindex(docId),
    onSuccess: () => {
      info('Re-indexing started in background');
      refetch();
    },
    onError: (err) => toastError(getErrorMessage(err)),
  });

  const handleDownload = async () => {
    if (!doc) return;
    try {
      await documentsApi.download(doc.id, doc.name);
      success(`Downloaded ${doc.name}`);
    } catch (err) {
      toastError(getErrorMessage(err));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Retrieving document metadata...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">Document not found</h3>
        <p className="text-sm text-slate-400 mb-4">
          This document might have been removed or you do not have permission to view it.
        </p>
        <button
          onClick={() => navigate('/documents')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
        >
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/documents')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={() => reindexMutation.mutate()}
            disabled={reindexMutation.isPending}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-blue-400 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
            Re-index
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl text-sm font-medium border border-rose-800/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Main Document Details Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shrink-0">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white break-all">{doc.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  variant={
                    doc.status === 'Indexed' ? 'success' : doc.status === 'Processing' ? 'warning' : 'danger'
                  }
                >
                  {doc.status}
                </Badge>
                <span className="uppercase text-xs font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  {doc.file_type}
                </span>
                <span className="text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  Category: {doc.category}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error message banner if indexing failed */}
        {doc.error_message && (
          <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-rose-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Indexing Failed</p>
              <p className="text-xs text-rose-300/80 mt-1">{doc.error_message}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {doc.description && (
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</h4>
            <p className="text-sm text-slate-300 leading-relaxed">{doc.description}</p>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">File Size</p>
              <p className="text-sm font-medium text-white">{formatFileSize(doc.size_bytes)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Uploaded By</p>
              <p className="text-sm font-medium text-white">{doc.uploaded_by}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Uploaded Date</p>
              <p className="text-sm font-medium text-white">
                {format(new Date(doc.uploaded_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">RAG Citations Count</p>
              <p className="text-sm font-medium text-white">{doc.usage_count} citations</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Indexed At</p>
              <p className="text-sm font-medium text-white">
                {doc.indexed_at ? format(new Date(doc.indexed_at), 'MMM d, yyyy HH:mm') : 'Pending / Not indexed'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/40">
            <FolderKanban className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold">MIME Type</p>
              <p className="text-sm font-medium text-white truncate max-w-[180px]">{doc.mime_type}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Document?"
        message={`Are you sure you want to permanently delete "${doc.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
