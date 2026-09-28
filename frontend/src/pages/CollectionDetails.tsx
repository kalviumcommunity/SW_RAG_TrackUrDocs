import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collectionsApi } from '../api/collections';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import {
  FolderKanban,
  ArrowLeft,
  Files,
  FileText,
  Loader2,
  AlertTriangle,
  UploadCloud,
} from 'lucide-react';

export const CollectionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const colId = id ? parseInt(id, 10) : 0;
  const navigate = useNavigate();

  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['collection', colId],
    queryFn: () => collectionsApi.get(colId),
    enabled: colId > 0,
  });

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Loading collection details...</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">Collection not found</h3>
        <p className="text-sm text-slate-400 mb-4">
          This collection may have been removed or does not exist.
        </p>
        <button
          onClick={() => navigate('/collections')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
        >
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/collections')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Collections
        </button>

        <button
          onClick={() => navigate(`/documents?upload=true&collection_id=${colId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-500/20 transition-colors"
        >
          <UploadCloud className="w-4 h-4" />
          Upload to Collection
        </button>
      </div>

      {/* Collection Header Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shrink-0">
            <FolderKanban className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{collection.name}</h1>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              {collection.description || 'No description provided.'}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Files className="w-3.5 h-3.5 text-slate-500" />
                {collection.documents?.length ?? 0} assigned documents
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Documents in Collection */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xs">
        <div className="p-4 border-b border-slate-800 bg-slate-900/90">
          <h2 className="text-sm font-semibold text-white">Documents in this collection</h2>
        </div>

        {collection.documents && collection.documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {collection.documents.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/documents/${d.id}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate max-w-sm">{d.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{d.category}</td>
                    <td className="py-3 px-4">{getStatusBadge(d.status)}</td>
                    <td className="py-3 px-4 text-right text-xs text-blue-400 hover:underline">
                      Inspect →
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Files}
            title="No documents in this collection"
            description="Add documents to this collection using the upload button or document settings."
            action={{
              label: 'Upload Document to Collection',
              onClick: () => navigate(`/documents?upload=true&collection_id=${colId}`),
            }}
          />
        )}
      </div>
    </div>
  );
};
