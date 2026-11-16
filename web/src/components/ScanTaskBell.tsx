import { useScanTasks } from '../providers/ScanTaskProvider';

type Props = { onClick: () => void };

const RUNNING = ['submitting', 'pending', 'processing'];
const FAILED = ['failed', 'consume_failed'];

export default function ScanTaskBell({ onClick }: Props) {
  const { tasks } = useScanTasks();
  const runningCount = tasks.filter((t) => RUNNING.includes(t.status)).length;
  const failedCount = tasks.filter((t) => FAILED.includes(t.status)).length;
  const isEmpty = tasks.length === 0;

  const isActive = runningCount > 0 || failedCount > 0;

  let iconColor = 'text-slate-400';
  if (runningCount > 0) iconColor = 'text-slate-900';
  else if (failedCount > 0) iconColor = 'text-slate-900';
  else if (!isEmpty) iconColor = 'text-slate-600';

  const showBadge = runningCount > 0;
  const badgeClass =
    failedCount > 0
      ? 'bg-red-500 text-white'
      : 'bg-slate-900 text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'relative w-11 h-11 flex items-center justify-center rounded-md transition-colors ' +
        (isActive
          ? 'bg-slate-100 hover:bg-slate-200'
          : 'hover:bg-slate-100')
      }
      aria-label="扫描任务"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={'w-5 h-5 ' + iconColor}
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {showBadge && (
        <span
          className={
            'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-medium flex items-center justify-center px-1 animate-pulse ' +
            badgeClass
          }
        >
          {runningCount}
        </span>
      )}

      {!showBadge && failedCount > 0 && (
        <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500" />
      )}
    </button>
  );
}