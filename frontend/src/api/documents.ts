import { api } from './client';

export interface Document {
  id: number;
  name: string;
  file_type: string;
  size_bytes: number;
  category: string;
  collection_id: number | null;
  status: 'Processing' | 'Indexed' | 'Failed';
  uploaded_by: string;
  uploaded_at: string;
  updated_at: string;
}

export interface DocumentDetail extends Document {
  mime_type: string;
  description: string | null;
  error_message: string | null;
  usage_count: number;
  indexed_at: string | null;
}

export interface DocumentsFilters {
  search?: string;
  file_type?: string;
  status?: string;
  category?: string;
  collection_id?: number;
  skip?: number;
  limit?: number;
}

export const documentsApi = {
  list: (filters: DocumentsFilters = {}) =>
    api.get<Document[]>('/documents', { params: filters }).then(r => r.data),

  get: (id: number) =>
    api.get<DocumentDetail>(`/documents/${id}`).then(r => r.data),

  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    api.post<Document>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }).then(r => r.data),

  download: async (id: number, name: string) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data]);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  reindex: (id: number) =>
    api.post(`/documents/${id}/reindex`).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/documents/${id}`).then(r => r.data),
};
