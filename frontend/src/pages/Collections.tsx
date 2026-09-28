import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { collectionsApi, type Collection } from '../api/collections';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import {
  FolderKanban,
  Plus,
  Files,
  Loader2,
  ChevronRight,
  FolderPlus,
} from 'lucide-react';

export const Collections: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Collection name is required');
      return collectionsApi.create({ name: name.trim(), description: description.trim() || undefined });
    },
    onSuccess: (newCol) => {
      success(`Created collection "${newCol.name}"`);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      setName('');
      setDescription('');
    },
    onError: (err) => {
      toastError(getErrorMessage(err));
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Document Collections</h1>
          <p className="text-sm text-slate-400 mt-1">
            Group enterprise documents into structured department collections, projects, and domains.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Collection
        </button>
      </div>

      {/* Collections Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="text-sm">Loading collections...</p>
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map((col: Collection) => (
            <div
              key={col.id}
              onClick={() => navigate(`/collections/${col.id}`)}
              className="group p-5 bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/40 rounded-2xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="font-semibold text-base text-white group-hover:text-blue-300 transition-colors">
                  {col.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {col.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Files className="w-3.5 h-3.5 text-slate-500" />
                  {col.document_count} {col.document_count === 1 ? 'document' : 'documents'}
                </span>
                <span className="text-blue-400 group-hover:underline">View docs →</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No collections created"
          description="Create your first collection to group policies, manuals, and technical reports."
          action={{
            label: 'Create Collection',
            onClick: () => setCreateOpen(true),
          }}
        />
      )}

      {/* Create Collection Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Collection" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Collection Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Company Policies, Engineering Specs"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of documents belong here?"
              rows={3}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              Create Collection
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
