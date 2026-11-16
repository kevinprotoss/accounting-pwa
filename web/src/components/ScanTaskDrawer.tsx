import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { attachmentUrl, scansApi, type ScanTask } from '../api/scans';
import { useScanTasks } from '../providers/ScanTaskProvider';

type Props = { open: boolean; onClose: () => void };

const STATUS_KEYS: Record<string, string> = {
  submitting: 'scan.status_submitting',
  pending: 'scan.status_pending',
  processing: 'scan.status_processing',
  ready: 'scan.status_ready',
  consumed: 'scan.status_consumed',
  failed: 'scan.status_failed',
  consume_failed: 'scan.status_consume_failed',
};

function statusOrder(s: string): number {
  if (s === 'failed' || s === 'consume_failed') return 0;
  if (s === 'processing' || s === 'pending' || s === 'submitting') return 1;
  if (s === 'ready') return 2;
  return 3;
}

export default function ScanTaskDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { tasks } = useScanTasks();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedUncertain, setExpandedUncertain] = useState<Set<string>>(
    new Set()
  );
  const [clearing, setClearing] = useState(false);
  const [working, setWorking] = useState<Set<string>>(new Set());

  const sorted = [...tasks].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return b.created_at.localeCompare(a.created_at);
  });

  const completedCount = tasks.filter((t) => t.status === 'consumed').length;

  function toggleTask(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleUncertain(key: string) {
    setExpandedUncertain((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRetry(id: string) {
    setWorking((prev) => new Set(prev).add(id));
    try {
      await scansApi.retry(id);
    } catch (err) {
      alert(String(err));
    } finally {
      setWorking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDiscard(id: string) {
    if (!window.confirm(t('scan.discard_confirm'))) return;
    setWorking((prev) => new Set(prev).add(id));
    try {
      await scansApi.discard(id);
    } catch (err) {
      alert(String(err));
    } finally {
      setWorking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleClearCompleted() {
    if (!window.confirm(t('scan.clear_confirm', { count: completedCount }))) return;
    setClearing(true);
    try {
      await scansApi.clearCompleted();
    } catch (err) {
      alert(String(err));
    } finally {
      setClearing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl flex flex-col shadow-2xl md:max-w-2xl md:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold">{t('scan.tasks_title')}</h2>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompleted}
                disabled={clearing}
                className="h-8 px-2 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                {clearing ? t('scan.clearing') : t('scan.clear_completed')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sorted.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              {t('scan.no_tasks')}
            </div>
          )}

          {sorted.map((task) => (
            <TaskCard
              key={task.scan_id}
              task={task}
              expanded={expandedTasks.has(task.scan_id)}
              onToggle={() => toggleTask(task.scan_id)}
              expandedUncertain={expandedUncertain}
              onToggleUncertain={toggleUncertain}
              working={working.has(task.scan_id)}
              onRetry={() => handleRetry(task.scan_id)}
              onDiscard={() => handleDiscard(task.scan_id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  expanded,
  onToggle,
  expandedUncertain,
  onToggleUncertain,
  working,
  onRetry,
  onDiscard,
}: {
  task: ScanTask;
  expanded: boolean;
  onToggle: () => void;
  expandedUncertain: Set<string>;
  onToggleUncertain: (key: string) => void;
  working: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const isFailed =
    task.status === 'failed' || task.status === 'consume_failed';
  const isRunning = ['submitting', 'pending', 'processing'].includes(task.status);
  const isConsumed = task.status === 'consumed';
  const canDelete = task.status !== 'ready';
  const preview = task.image_paths[0];
  const typeLabel =
    task.target_type === 'receipt'
      ? t('scan.target_receipt')
      : t('scan.target_expense');

  return (
    <div
      className={
        'rounded-lg border p-3 ' +
        (isFailed
          ? 'border-red-200 bg-red-50/40'
          : 'border-slate-200 bg-white')
      }
    >
      <div className="flex items-start gap-3">
        {preview && (
          <img
            src={attachmentUrl(preview)}
            alt=""
            className="w-14 h-14 rounded object-cover bg-slate-100 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{typeLabel}</span>
            <span className="text-slate-500">·</span>
            <span
              className={
                isFailed
                  ? 'text-red-600'
                  : isConsumed
                  ? 'text-green-700'
                  : 'text-slate-600'
              }
            >
              {STATUS_KEYS[task.status]
                ? t(STATUS_KEYS[task.status])
                : task.status}
            </span>
            {isRunning && (
              <span className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin shrink-0" />
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {t('scan.page_count', { count: task.image_paths.length })} ·{' '}
            {task.created_at.replace('T', ' ')}
            {task.uncertain_count > 0 && isConsumed && (
              <>
                {' · '}
                {t('scan.uncertain_count', { count: task.uncertain_count })}
              </>
            )}
          </div>
          {task.error_message && (
            <div className="text-xs text-red-600 mt-1 break-all">
              {task.error_message}
            </div>
          )}
        </div>
      </div>

      {isConsumed && task.uncertain_count > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center justify-between"
          >
            <span>
              ⚠ {t('scan.uncertain_count', { count: task.uncertain_count })}
            </span>
            <span>
              {expanded
                ? `${t('scan.uncertain_collapse')} ▴`
                : `${t('scan.uncertain_expand')} ▾`}
            </span>
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {task.uncertain_items.map((u, i) => {
                const key = `${task.scan_id}-${i}`;
                const open = expandedUncertain.has(key);
                return (
                  <li
                    key={key}
                    className="rounded bg-amber-50/60 border border-amber-100"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleUncertain(key)}
                      className="w-full text-left px-2 py-1.5"
                    >
                      <div className="text-xs font-medium text-amber-800 truncate">
                        ▸ {u.field ?? t('scan.uncertain_field_none')}
                      </div>
                      <div
                        className={
                          'text-xs text-amber-700 mt-0.5 ' +
                          (open ? '' : 'line-clamp-1')
                        }
                      >
                        {u.reason}
                      </div>
                    </button>
                    {open && u.source_text && u.source_text.length > 0 && (
                      <div className="px-2 pb-2">
                        <div className="text-[10px] font-medium text-amber-600 mb-1">
                          {t('scan.ocr_source_text')}
                        </div>
                        <ul className="text-xs text-amber-800 font-mono bg-white rounded px-2 py-1 space-y-0.5">
                          {u.source_text.map((txt, j) => (
                            <li key={j}>· {txt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {(isFailed || canDelete) && (
        <div className="mt-2 flex justify-end gap-2">
          {isFailed && (
            <button
              type="button"
              onClick={onRetry}
              disabled={working}
              className="h-8 px-3 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {working ? t('scan.retrying') : t('scan.retry')}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={working}
              className="h-8 px-3 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {t('scan.discard')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}