import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scansApi } from '../api/scans';

type Props = {
  open: boolean;
  targetType: 'receipt' | 'expense';
  onClose: () => void;
  onUploaded: () => void;
};

export default function ScanUploadDialog({
  open,
  targetType,
  onClose,
  onUploaded,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (open) {
      setFiles([]);
      setUploading(false);
      setError(null);
    }
  }, [open]);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) {
      setError(t('scan.no_images'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await scansApi.upload(targetType, files);
      onUploaded();
      dialogRef.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const title =
    targetType === 'receipt'
      ? t('scan.upload_title_receipt')
      : t('scan.upload_title_expense');

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[90vw] max-w-md m-auto rounded-xl p-0 bg-white text-slate-900 backdrop:bg-black/40"
    >
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-slate-500 mt-1">{t('scan.upload_hint')}</p>
      </div>

      <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* 两个入口：拍照 / 相册 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="h-24 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50 flex flex-col items-center justify-center gap-1 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-sm">{t('scan.take_photo')}</span>
          </button>

          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            disabled={uploading}
            className="h-24 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50 flex flex-col items-center justify-center gap-1 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-sm">{t('scan.from_album')}</span>
          </button>
        </div>

        {/* 相机：直接唤起后置摄像头，一次一张，不能带 multiple */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleSelect}
        />

        {/* 相册：可多选，不能带 capture */}
        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleSelect}
        />

        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1.5"
              >
                <span className="flex-1 min-w-0 truncate">{f.name}</span>
                <span className="text-xs text-slate-400 shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-red-600 hover:bg-red-50"
                  aria-label={t('common.remove')}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          disabled={uploading}
          className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {uploading
            ? t('scan.uploading')
            : t('scan.upload_count', { count: files.length })}
        </button>
      </div>
    </dialog>
  );
}
