import { useRef, useState } from 'react';
import { attachmentsApi } from '../api/attachments';

function displayName(p: string): string {
  const filename = p.split('/').pop() ?? p;
  const parts = filename.split('_');
  if (parts.length >= 3) return parts.slice(2).join('_');
  return filename;
}

type Props = {
  paths: string[];
  onChange: (paths: string[]) => void;
  label?: string;
};

export default function AttachmentUploader({ paths, onChange, label }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await attachmentsApi.upload(files);
      onChange([...paths, ...uploaded.map((u) => u.path)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(p: string) {
    if (!window.confirm(`移除附件「${displayName(p)}」？文件会进回收站。`)) {
      return;
    }
    try {
      await attachmentsApi.remove(p);
      onChange(paths.filter((x) => x !== p));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-slate-600">{label}</div>}
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-10 px-3 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {uploading ? '上传中…' : '+ 添加附件'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>
      {paths.length > 0 && (
        <ul className="space-y-1">
          {paths.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1.5"
            >
              <a
                href={attachmentsApi.url(p)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-0 truncate text-slate-700 hover:text-slate-900 hover:underline"
                title={displayName(p)}
              >
                {displayName(p)}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(p)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded text-red-600 hover:bg-red-50"
                aria-label="移除"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}