import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="w-[90vw] max-w-sm m-auto rounded-xl p-0 bg-white text-slate-900 backdrop:bg-black/40"
    >
      <div className="p-4">
        <h2 className="text-base font-semibold mb-2">{title}</h2>
        {message && <div className="text-sm text-slate-600">{message}</div>}
      </div>
      <div className="px-4 pb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {cancelLabel ?? t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={
            danger
              ? 'h-11 px-4 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60'
              : 'h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60'
          }
        >
          {loading ? t('common.processing') : confirmLabel ?? t('common.confirm')}
        </button>
      </div>
    </dialog>
  );
}