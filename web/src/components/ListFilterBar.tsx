import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { TIME_PRESETS, presetI18nKey, type ListFilter, type TimePreset } from '../lib/listFilter';

type StatusOption = { value: string; label: string };

type Props = {
  filter: ListFilter;
  onChange: (next: Partial<ListFilter>) => void;
  onClear: () => void;
  statusOptions: StatusOption[];
  searchPlaceholder: string;
};

const lgPrimaryPresets: TimePreset[] = ['all', 'month', 'lastMonth', 'year'];
const lgExtraPresets: TimePreset[] = ['today', 'week', 'custom'];

function FilterPanelContent({
  filter,
  onChange,
  statusOptions,
  onReset,
}: {
  filter: ListFilter;
  onChange: (next: Partial<ListFilter>) => void;
  statusOptions: StatusOption[];
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <div className="text-xs font-medium text-slate-600 mb-2">
          {t('filter.custom')}
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (p === 'custom') {
                  onChange({ timePreset: 'custom' });
                } else {
                  onChange({ timePreset: p, customFrom: '', customTo: '' });
                }
              }}
              className={cn(
                'h-9 px-3 text-sm rounded-md border whitespace-nowrap',
                filter.timePreset === p
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300'
              )}
            >
              {t(presetI18nKey(p))}
            </button>
          ))}
        </div>
        {filter.timePreset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">
                {t('filter.start_date')}
              </span>
              <input
                type="date"
                value={filter.customFrom}
                onChange={(e) => onChange({ customFrom: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">
                {t('filter.end_date')}
              </span>
              <input
                type="date"
                value={filter.customTo}
                onChange={(e) => onChange({ customTo: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-sm"
              />
            </label>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-slate-600 mb-2">
          {t('filter.status')}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ status: o.value })}
              className={cn(
                'h-9 px-3 text-sm rounded-md border whitespace-nowrap',
                filter.status === o.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full h-10 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
      >
        {t('common.reset')}
      </button>
    </>
  );
}

export default function ListFilterBar({
  filter,
  onChange,
  onClear,
  statusOptions,
  searchPlaceholder,
}: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState(filter.keyword);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lgMoreOpen, setLgMoreOpen] = useState(false);
  const lgMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(filter.keyword);
  }, [filter.keyword]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input !== filter.keyword) onChange({ keyword: input });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (!lgMoreOpen) return;
    function handleClick(e: MouseEvent) {
      if (lgMoreRef.current && !lgMoreRef.current.contains(e.target as Node)) {
        setLgMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [lgMoreOpen]);

  const activeTags: { key: string; label: string; onRemove: () => void }[] = [];
  if (filter.timePreset !== 'month' && filter.timePreset !== 'all') {
    if (filter.timePreset === 'custom') {
      if (filter.customFrom && filter.customTo) {
        activeTags.push({
          key: 'time',
          label: `${filter.customFrom} ~ ${filter.customTo}`,
          onRemove: () =>
            onChange({ timePreset: 'month', customFrom: '', customTo: '' }),
        });
      }
    } else {
      activeTags.push({
        key: 'time',
        label: t(presetI18nKey(filter.timePreset)),
        onRemove: () =>
          onChange({ timePreset: 'month', customFrom: '', customTo: '' }),
      });
    }
  }
  if (filter.status !== 'all') {
    const s = statusOptions.find((x) => x.value === filter.status);
    if (s) {
      activeTags.push({
        key: 'status',
        label: s.label,
        onRemove: () => onChange({ status: 'all' }),
      });
    }
  }
  if (filter.keyword.trim()) {
    activeTags.push({
      key: 'keyword',
      label: `"${filter.keyword.trim()}"`,
      onRemove: () => {
        setInput('');
        onChange({ keyword: '' });
      },
    });
  }
  const activeCount = activeTags.length;

  const lgExtraActive = lgExtraPresets.includes(filter.timePreset);

  function resetAll() {
    setInput('');
    onClear();
  }

  function renderChip(p: TimePreset, compact = false) {
    return (
      <button
        key={p}
        type="button"
        onClick={() => {
          if (p === 'custom') {
            onChange({ timePreset: 'custom' });
          } else {
            onChange({ timePreset: p, customFrom: '', customTo: '' });
          }
        }}
        className={cn(
          'h-9 text-sm rounded-md border whitespace-nowrap',
          compact ? 'px-2.5' : 'px-3',
          filter.timePreset === p
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
        )}
      >
        {t(presetI18nKey(p))}
      </button>
    );
  }

  return (
    <div className="-mx-4 px-4 md:mx-0 md:px-0">
      <div className="sticky top-0 z-30 bg-slate-50 py-2 md:static md:bg-transparent md:py-0">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-10 rounded-md border border-slate-300 pl-3 pr-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={t('common.remove')}
              >
                ✕
              </button>
            )}
          </div>

          {/* xl: 全部胶囊平铺 */}
          <div className="hidden xl:flex gap-1.5 items-center shrink-0">
            {TIME_PRESETS.map((p) => renderChip(p, true))}
            <select
              value={filter.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="h-9 rounded-md border border-slate-300 px-2 text-sm bg-white whitespace-nowrap"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* lg: 4 个常用胶囊 + Mehr 下拉 + 状态下拉 */}
          <div className="hidden lg:flex xl:hidden gap-1.5 items-center shrink-0">
            {TIME_PRESETS.filter((p) => lgPrimaryPresets.includes(p)).map(
              (p) => renderChip(p, true)
            )}
            <div ref={lgMoreRef} className="relative">
              <button
                type="button"
                onClick={() => setLgMoreOpen((v) => !v)}
                className={cn(
                  'h-9 px-2.5 text-sm rounded-md border whitespace-nowrap flex items-center gap-1',
                  lgExtraActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                )}
              >
                {t('filter.more')}
                <span className="text-[10px]">▾</span>
              </button>
              {lgMoreOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-40 space-y-1">
                  {TIME_PRESETS.filter((p) => lgExtraPresets.includes(p)).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (p === 'custom') {
                            onChange({ timePreset: 'custom' });
                          } else {
                            onChange({
                              timePreset: p,
                              customFrom: '',
                              customTo: '',
                            });
                          }
                          setLgMoreOpen(false);
                        }}
                        className={cn(
                          'w-full text-left h-9 px-2 text-sm rounded-md whitespace-nowrap',
                          filter.timePreset === p
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        {t(presetI18nKey(p))}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
            <select
              value={filter.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="h-9 rounded-md border border-slate-300 px-2 text-sm bg-white whitespace-nowrap"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* md: 更多按钮 + popover */}
          <div className="hidden md:block lg:hidden relative">
            <button
              type="button"
              onClick={() => setPopoverOpen((v) => !v)}
              className={cn(
                'h-10 px-3 text-sm rounded-md border whitespace-nowrap flex items-center gap-1',
                activeCount > 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              )}
            >
              {t('filter.more')}
              {activeCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-slate-900 text-[10px] font-medium">
                  {activeCount}
                </span>
              )}
            </button>
            {popoverOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setPopoverOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-40 space-y-3">
                  <FilterPanelContent
                    filter={filter}
                    onChange={onChange}
                    statusOptions={statusOptions}
                    onReset={resetAll}
                  />
                  <button
                    type="button"
                    onClick={() => setPopoverOpen(false)}
                    className="w-full h-10 text-sm rounded-md bg-slate-900 text-white"
                  >
                    {t('filter.apply')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 手机: 筛选按钮 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'md:hidden h-10 px-3 text-sm rounded-md border whitespace-nowrap flex items-center gap-1',
              activeCount > 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300'
            )}
          >
            {t('filter.filter')}
            {activeCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-slate-900 text-[10px] font-medium">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* lg 和 xl 下自定义日期输入 */}
      {filter.timePreset === 'custom' && (
        <div className="hidden lg:flex items-center gap-2 pt-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            {t('filter.start_date')}
            <input
              type="date"
              value={filter.customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
              className="h-8 rounded-md border border-slate-300 px-2 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            {t('filter.end_date')}
            <input
              type="date"
              value={filter.customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
              className="h-8 rounded-md border border-slate-300 px-2 text-sm bg-white"
            />
          </label>
        </div>
      )}

      {/* 筛选标签行 */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap pb-2 md:pt-2">
          <div className="flex gap-1.5 flex-wrap">
            {activeTags.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-slate-200 text-xs text-slate-700"
              >
                {tag.label}
                <button
                  type="button"
                  onClick={tag.onRemove}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-slate-300 text-slate-500"
                  aria-label={t('common.remove')}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="ml-auto text-xs text-slate-600 hover:text-slate-900 underline"
          >
            {t('filter.clear_filter')}
          </button>
        </div>
      )}

      {/* 手机抽屉 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <FilterPanelContent
              filter={filter}
              onChange={onChange}
              statusOptions={statusOptions}
              onReset={resetAll}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-full h-11 text-sm rounded-md bg-slate-900 text-white"
            >
              {t('filter.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}