import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { expensesApi, type Expense } from '../api/expenses';
import { formatMoney } from '../lib/utils';
import {
  filterItems,
  filterSummary,
  formatMonthLabel,
  groupByMonth,
  type ListFilter,
} from '../lib/listFilter';
import ActionMenu, { type Action } from './ActionMenu';
import ConfirmDialog from './ConfirmDialog';
import ListFilterBar from './ListFilterBar';
import { useFilterSummaryText } from '../hooks/useFilterSummaryText';
import ScanTaskBell from './ScanTaskBell';
import ScanTaskDrawer from './ScanTaskDrawer';
import ScanUploadDialog from './ScanUploadDialog';

type Props = {
  filter: ListFilter;
  onFilterChange: (next: Partial<ListFilter>) => void;
  onFilterClear: () => void;
  expandedMonths: Set<string>;
  onExpandedChange: (months: Set<string>) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
};

const GRID_COLS =
  'grid-cols-[minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] ' +
  'lg:grid-cols-[minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]';

function expenseMatchKeyword(e: Expense, kw: string): boolean {
  return [e.category, e.description, e.supplier_invoice, e.remarks].some(
    (v) => v && v.toLowerCase().includes(kw)
  );
}

function expenseMatchStatus(e: Expense, status: string): boolean {
  if (status === 'input') return e.is_output_tax === 0;
  if (status === 'output') return e.is_output_tax === 1;
  return true;
}

export default function ExpenseList({
  filter,
  onFilterChange,
  onFilterClear,
  expandedMonths,
  onExpandedChange,
  onCreate,
  onEdit,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['expenses'],
    queryFn: expensesApi.list,
  });

  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const statusOptions = [
    { value: 'all', label: t('expense.status_all') },
    { value: 'input', label: t('expense.type_input') },
    { value: 'output', label: t('expense.type_output') },
  ];

  const filtered = useMemo(
    () => filterItems(data, filter, expenseMatchKeyword, expenseMatchStatus),
    [data, filter]
  );
  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const deleteMutation = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['tax'] });
      setDeleting(null);
    },
  });

  function patchFilter(next: Partial<ListFilter>) {
    onFilterChange(next);
  }

  function clearFilter() {
    onFilterClear();
  }

  function toggleMonth(month: string) {
    const next = new Set(expandedMonths);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    onExpandedChange(next);
  }

  useEffect(() => {
    if (grouped.length === 0) return;
    const hasVisible = grouped.some((g) => expandedMonths.has(g.month));
    if (!hasVisible) {
      onExpandedChange(new Set([grouped[0].month]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function actionsFor(e: Expense): Action[] {
    return [
      { key: 'edit', label: t('common.edit'), onSelect: () => onEdit(e.id) },
      {
        key: 'delete',
        label: t('common.delete'),
        danger: true,
        onSelect: () => setDeleting(e),
      },
    ];
  }

  const emptySummary = useFilterSummaryText(filterSummary(filter, statusOptions));

  return (
    <div className="space-y-4">
      <ListFilterBar
        filter={filter}
        onChange={patchFilter}
        onClear={clearFilter}
        statusOptions={statusOptions}
        searchPlaceholder={t('filter.search_expenses')}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500 shrink-0">
          {isLoading ? t('common.loading') : t('expense.count', { count: filtered.length })}
        </p>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setScanDialogOpen(true)}
            className="h-11 px-3 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="hidden sm:inline">{t('scan.button')}</span>
          </button>
          <ScanTaskBell onClick={() => setTaskDrawerOpen(true)} />
          <button
            onClick={onCreate}
            className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            <span className="hidden sm:inline">+ {t('expense.new')}</span>
            <span className="sm:hidden">+ {t('common.add')}</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('expense.empty_hint')}
        </div>
      )}

      {!isLoading && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('expense.no_match', { summary: emptySummary })}
          <button
            onClick={clearFilter}
            className="ml-2 text-slate-700 underline hover:text-slate-900"
          >
            {t('filter.clear_filter')}
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* 桌面表格 */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div
              role="row"
              className={`grid ${GRID_COLS} bg-slate-100 text-slate-600 text-sm`}
            >
              <div role="columnheader" className="px-3 py-2 text-left">
                {t('expense.date')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                {t('expense.category')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                {t('expense.description')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-right">
                {t('expense.column_net_tax')}
              </div>
              <div role="columnheader" className="hidden lg:block px-3 py-2 text-center">
                {t('expense.column_type')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-center">
                {t('common.actions')}
              </div>
            </div>

            {grouped.map((group) => {
              const expanded = expandedMonths.has(group.month);
              return (
                <div key={group.month}>
                  <div
                    role="row"
                    className="bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer select-none"
                    onClick={() => toggleMonth(group.month)}
                  >
                    <span className="mr-2 text-slate-400">
                      {expanded ? '▾' : '▸'}
                    </span>
                    {formatMonthLabel(group.month, i18n.language)} ({group.items.length})
                  </div>

                  {expanded &&
                    group.items.map((e) => (
                      <div
                        key={e.id}
                        role="row"
                        onClick={() => onEdit(e.id)}
                        className={`grid ${GRID_COLS} border-t border-slate-100 hover:bg-slate-50 cursor-pointer text-sm`}
                      >
                        <div role="cell" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{e.date}</span>
                            {e.needs_review === 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                {t('expense.needs_review')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div role="cell" className="px-3 py-2 min-w-0">
                          <div className="truncate" title={e.category ?? ''}>
                            {e.category ?? '—'}
                          </div>
                        </div>
                        <div role="cell" className="px-3 py-2 min-w-0">
                          <div className="truncate" title={e.description ?? ''}>
                            {e.description ?? '—'}
                          </div>
                        </div>
                        <div role="cell" className="px-3 py-2 text-right">
                          <div className="font-medium">
                            {formatMoney(e.net_amount)} €
                          </div>
                          <div className="text-xs text-slate-500">
                            {t('expense.tax_label')} {formatMoney(e.input_tax)} €
                          </div>
                        </div>
                        <div role="cell" className="hidden lg:block px-3 py-2 text-center">
                          {e.is_output_tax ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                              {t('expense.type_output')}
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {t('expense.type_input')}
                            </span>
                          )}
                        </div>
                        <div role="cell" className="px-3 py-2 text-center">
                          <div className="inline-flex justify-center">
                            <ActionMenu
                              actions={actionsFor(e)}
                              contextLabel={e.description ?? e.date}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          {/* 手机卡片 */}
          <div className="md:hidden space-y-4">
            {grouped.map((group) => {
              const expanded = expandedMonths.has(group.month);
              return (
                <div key={group.month}>
                  <div
                    className="sticky top-[92px] z-20 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => toggleMonth(group.month)}
                  >
                    <span>
                      {formatMonthLabel(group.month, i18n.language)} ({group.items.length})
                    </span>
                    <span className="text-slate-400">
                      {expanded ? '▾' : '▸'}
                    </span>
                  </div>
                  {expanded && (
                    <ul className="space-y-2 mt-2">
                      {group.items.map((e) => (
                        <li
                          key={e.id}
                          className="relative rounded-lg border border-slate-200 bg-white"
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onEdit(e.id)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' || ev.key === ' ') {
                                ev.preventDefault();
                                onEdit(e.id);
                              }
                            }}
                            className="w-full text-left p-3 pr-14 cursor-pointer hover:bg-slate-50 active:bg-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {e.category ?? e.description ?? '—'}
                              </span>
                              {e.is_output_tax === 1 && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {t('expense.type_output')}
                                </span>
                              )}
                              {e.needs_review === 1 && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                  {t('expense.needs_review')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {e.date} · {e.description ?? '—'}
                            </div>
                            <div className="text-sm text-slate-700 mt-1">
                              {t('expense.net_amount')}{' '}
                              <span className="font-medium">
                                {formatMoney(e.net_amount)} €
                              </span>
                              <span className="text-xs text-slate-500 ml-2">
                                · {t('expense.tax_label')} {formatMoney(e.input_tax)} €
                              </span>
                            </div>
                          </div>
                          <div className="absolute top-1 right-1">
                            <ActionMenu
                              actions={actionsFor(e)}
                              contextLabel={e.description ?? e.date}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <ScanUploadDialog
        open={scanDialogOpen}
        targetType="expense"
        onClose={() => setScanDialogOpen(false)}
        onUploaded={() => setScanDialogOpen(false)}
      />
      <ScanTaskDrawer
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('expense.delete_title')}
        message={
          deleting
            ? t('expense.delete_confirm', {
                label: deleting.category ?? deleting.date,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />

      {deleteMutation.error && (
        <p className="text-sm text-red-600">
          {t('expense.delete_failed', { error: String(deleteMutation.error) })}
        </p>
      )}
    </div>
  );
}