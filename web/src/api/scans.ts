import { request } from './client';

export type ScanTaskStatus =
  | 'submitting'
  | 'pending'
  | 'processing'
  | 'ready'
  | 'consumed'
  | 'failed'
  | 'consume_failed';

export type UncertainItem = {
  field?: string | null;
  reason: string;
  source_text?: string[];
};

export type ScanTask = {
  scan_id: string;
  remote_scan_id: string | null;
  target_type: 'receipt' | 'expense';
  image_paths: string[];
  status: ScanTaskStatus;
  error_message: string | null;
  record_type: 'goods_receipts' | 'other_expenses' | null;
  record_id: number | null;
  uncertain_items: UncertainItem[];
  uncertain_count: number;
  created_at: string;
  updated_at: string;
};

export const scansApi = {
  health: () =>
    request<{ available: boolean; status: string; error?: string }>(
      '/api/scans/health'
    ),

  tasks: () => request<ScanTask[]>('/api/scans/tasks'),

  upload: async (
    targetType: 'receipt' | 'expense',
    files: File[]
  ): Promise<ScanTask> => {
    const form = new FormData();
    form.append('target_type', targetType);
    files.forEach((f) => form.append('files', f, f.name));
    const res = await fetch('/api/scans', { method: 'POST', body: form });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let msg = `上传失败：${res.status}`;
      if (raw) {
        try {
          const data = JSON.parse(raw);
          msg = data.error || data.message || raw;
        } catch {
          msg = raw;
        }
      }
      throw new Error(msg);
    }
    return res.json();
  },

  retry: (scanId: string) =>
    request<{ ok: boolean }>(`/api/scans/${scanId}/retry`, { method: 'POST' }),

  discard: (scanId: string) =>
    request<void>(`/api/scans/${scanId}`, { method: 'DELETE' }),

  clearCompleted: () =>
    request<{ deleted: number }>('/api/scans/clear-completed', {
      method: 'POST',
    }),

  review: (recordType: 'goods_receipts' | 'other_expenses', recordId: number) =>
    request<{ ok: boolean; already?: boolean }>(
      `/api/scans/review/${recordType}/${recordId}`,
      { method: 'POST' }
    ),
};

export function attachmentUrl(relPath: string): string {
  return `/api/attachments/${relPath}`;
}