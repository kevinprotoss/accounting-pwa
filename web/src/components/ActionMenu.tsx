import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

export type Action = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

type Props = {
  actions: Action[];
  contextLabel?: string;
};

export default function ActionMenu({ actions, contextLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bottomSheetRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = actions.length * 36 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;

    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;

    setCoords({ top, left });
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        bottomSheetRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function handleScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  function handleAction(a: Action) {
    setOpen(false);
    a.onSelect();
  }

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-11 h-11 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        aria-label="更多操作"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-lg leading-none">⋯</span>
      </button>

      {/* 手机 bottom sheet */}
      {open &&
        createPortal(
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/40 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div
              ref={bottomSheetRef}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-2xl"
            >
              {contextLabel && (
                <div className="px-4 py-3 border-b border-slate-200 text-xs text-slate-500 truncate">
                  {contextLabel}
                </div>
              )}
              <div className="py-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => handleAction(a)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left',
                      a.danger ? 'text-red-600' : 'text-slate-800',
                      'hover:bg-slate-50 active:bg-slate-100'
                    )}
                  >
                    {a.icon && <span className="w-5 flex-shrink-0">{a.icon}</span>}
                    <span>{a.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full px-4 py-3.5 text-sm text-slate-500 text-left border-t border-slate-100 mt-2 hover:bg-slate-50 active:bg-slate-100"
                >
                  取消
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* 桌面下拉 */}
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="hidden md:block fixed z-50 w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1"
            style={{ top: coords.top, left: coords.left }}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => handleAction(a)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  a.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                {a.icon && <span className="w-4 flex-shrink-0">{a.icon}</span>}
                <span>{a.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}