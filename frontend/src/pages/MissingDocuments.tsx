import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  expectedDocumentsApi,
  type ExpectedDocument,
  type CreateExpectedPayload,
} from '../api/expectedDocuments';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import {
  FileQuestion,
  Plus,
  Calendar,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const MissingDocuments: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HR');
  const [priority, setPriority] = useState('High');
  const [dueDate, setDueDate] = useState('');

  const { data: expected, isLoading } = useQuery({
    queryKey: ['expected-documents'],
    queryFn: expectedDocumentsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateExpectedPayload) => expectedDocumentsApi.create(payload),
    onSuccess: (newDoc) => {
      success(`Added expected document requirement: "${newDoc.name}"`);
      queryClient.invalidateQueries({ queryKey: ['expected-documents'] });
      setCreateOpen(false);
      setName('');
      setDueDate('');
    },
    onError: (err) => toastError(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      category,
      priority,
      due_date: dueDate || null,
    });
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'High':
        return <Badge variant="danger">High</Badge>;
      case 'Medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'Low':
        return <Badge variant="info">Low</Badge>;
      default:
        return <Badge variant="default">{p}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Expected & Missing Documents</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track mandatory enterprise policies and compliance documents, and identify missing knowledge gaps.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expected Document
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm">Fetching document compliance checklist...</p>
          </div>
        ) : expected && expected.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/90 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Expected Document Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {expected.map((item: ExpectedDocument) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5">
                      {item.status === 'Missing' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span className="font-semibold">{item.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{item.category}</td>
                    <td className="py-3.5 px-4">{getPriorityBadge(item.priority)}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {item.due_date ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {item.due_date}
                        </span>
                      ) : (
                        'No deadline'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.status === 'Missing' ? (
                        <Badge variant="danger">Missing</Badge>
                      ) : (
                        <Badge variant="success">Available</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {item.status === 'Missing' ? (
                        <button
                          onClick={() => navigate('/documents?upload=true')}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs font-semibold border border-blue-500/30 transition-colors"
                        >
                          <UploadCloud className="w-3 h-3" />
                          Upload Now
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 font-medium">Fulfilled ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FileQuestion}
            title="No expected documents configured"
            description="Add mandatory compliance, operational, and departmental documents to track knowledge coverage."
            action={{
              label: 'Add First Expected Document',
              onClick: () => setCreateOpen(true),
            }}
          />
        )}
      </div>

      {/* Add Expected Document Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Expected Document Requirement" maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Document Title / Requirement
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., SOC2 Type II Report, Employee Handbook 2026"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="HR">HR</option>
                <option value="Compliance">Compliance</option>
                <option value="Legal">Legal</option>
                <option value="Security">Security</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Compliance Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
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
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Requirement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
