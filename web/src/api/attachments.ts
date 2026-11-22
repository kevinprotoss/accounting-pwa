export type Attachment = {
    path: string;
    originalName: string;
    size: number;
  };
  
  export const attachmentsApi = {
    upload: async (files: File[]): Promise<Attachment[]> => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f, f.name));
      const res = await fetch('/api/attachments', { method: 'POST', body: form });
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
    remove: async (path: string) => {
      const res = await fetch('/api/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(raw || `删除失败：${res.status}`);
      }
    },
    url: (path: string) => `/api/attachments/${path}`,
  };