import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { documentsApi, type Document } from '../api/documents';
import { collectionsApi } from '../api/collections';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import {
  Files,
  UploadCloud,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Documents: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();

  // Search & Filter States
  const search = searchParams.get('search') || '';
  const fileType = searchParams.get('file_type') || '';
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const collectionId = searchParams.get('collection_id') || '';

  // Modals state
  const [uploadOpen, setUploadOpen] = useState(searchParams.get('upload') === 'true');
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('HR');
  const [uploadCollectionId, setUploadCollectionId] = useState<string>('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Fetch Collections for Filter & Upload dropdowns
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.list,
  });

  // Fetch Documents with Server-Side Filters
  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents', { search, fileType, status, category, collectionId }],
    queryFn: () =>
      documentsApi.list({
        search: search || undefined,
        file_type: fileType || undefined,
        status: status || undefined,
        category: category || undefined,
        collection_id: collectionId ? parseInt(collectionId, 10) : undefined,
      }),
  });

  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setUploadOpen(true);
    }
  }, [searchParams]);

  const updateFilters = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      if (uploadCollectionId) {
        formData.append('collection_id', uploadCollectionId);
      }
      if (uploadDescription) {
        formData.append('description', uploadDescription);
      }
      return documentsApi.upload(formData, (pct) => setUploadProgress(pct));
    },
    onSuccess: (newDoc) => {
      success(`Uploaded "${newDoc.name}" successfully`);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setUploadOpen(false);
      setFile(null);
      setUploadDescription('');
      setUploadProgress(null);
    },
    onError: (err) => {
      toastError(getErrorMessage(err));
      setUploadProgress(null);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => documentsApi.delete(id),
    onSuccess: () => {
      success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteDoc(null);
    },
    onError: (err) => {
      toastError(getErrorMessage(err));
    },
  });

  // Reindex Mutation
  const reindexMutation = useMutation({
    mutationFn: async (id: number) => documentsApi.reindex(id),
    onSuccess: () => {
      info('Re-indexing queued for document');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err) => {
      toastError(getErrorMessage(err));
    },
  });

  const handleDownload = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await documentsApi.download(doc.id, doc.name);
      success(`Downloading ${doc.name}`);
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

  const getStatusBadge = (docStatus: string) => {
    switch (docStatus) {
      case 'Indexed':
        return <Badge variant="success">Indexed</Badge>;
      case 'Processing':
        return <Badge variant="warning">Processing</Badge>;
      case 'Failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">{docStatus}</Badge>;
    }
  };

  const hasActiveFilters = Boolean(search || fileType || status || category || collectionId);

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Document Repository</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage enterprise documentation, track vector indexing status, and search parsed records.
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-500/20 transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => updateFilters('search', e.target.value)}
              placeholder="Search documents by name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => updateFilters('status', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="Indexed">Indexed</option>
              <option value="Processing">Processing</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {/* File Type Filter */}
          <div>
            <select
              value={fileType}
              onChange={(e) => updateFilters('file_type', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All File Types</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="xlsx">XLSX</option>
              <option value="pptx">PPTX</option>
              <option value="txt">TXT</option>
              <option value="md">Markdown</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => updateFilters('category', e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Categories</option>
              <option value="HR">HR</option>
              <option value="Legal">Legal</option>
              <option value="Engineering">Engineering</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Active filter badges & clear button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              Active filters applied
            </span>
            <button
              onClick={clearFilters}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm">Fetching document records...</p>
          </div>
        ) : docs && docs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/90 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Format</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="truncate max-w-xs">
                        <span className="truncate block font-semibold">{doc.name}</span>
                        <span className="text-[11px] text-slate-400">by {doc.uploaded_by}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{doc.category}</td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase text-xs font-bold text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{formatFileSize(doc.size_bytes)}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(doc.status)}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true })}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleDownload(doc, e)}
                          title="Download document"
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => reindexMutation.mutate(doc.id)}
                          title="Re-index document"
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDoc(doc)}
                          title="Delete document"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Files}
            title={hasActiveFilters ? 'No matching documents' : 'No documents found'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search query or removing active filters.'
                : 'Upload your company documents to enable automated vector indexing and RAG answering.'
            }
            action={
              hasActiveFilters
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'Upload Document', onClick: () => setUploadOpen(true) }
            }
          />
        )}
      </div>

      {/* Upload Document Modal */}
      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Enterprise Document" maxWidth="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadMutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                setFile(e.dataTransfer.files[0]);
              }
            }}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/50"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            <UploadCloud className="w-10 h-10 text-blue-400 mx-auto mb-2" />
            {file ? (
              <div>
                <p className="font-semibold text-white text-sm">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{formatFileSize(file.size)}</p>
                <p className="text-xs text-blue-400 mt-2 font-medium">Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-200 text-sm">Drag & drop your document here, or browse</p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: PDF, DOCX, XLSX, PPTX, TXT, MD (Max 50MB)
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="HR">HR</option>
                <option value="Legal">Legal</option>
                <option value="Engineering">Engineering</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Assign to Collection (Optional)
              </label>
              <select
                value={uploadCollectionId}
                onChange={(e) => setUploadCollectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">None (Unassigned)</option>
                {collections?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Description (Optional)
            </label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Brief summary of document contents..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Progress bar */}
          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              disabled={uploadMutation.isPending}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploadMutation.isPending}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading & Queuing Index...
                </>
              ) : (
                'Upload & Index'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
        title="Delete Document?"
        message={`Are you sure you want to permanently delete "${deleteDoc?.name}"? The stored file and all vector embeddings will be removed.`}
        confirmLabel="Delete Document"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
