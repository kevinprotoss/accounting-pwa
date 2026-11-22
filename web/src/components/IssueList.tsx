import { Fragment, useMemo, useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  issuesApi,
  waitForInvoicePdf,
  type IssueSummary,
} from '../api/issues';
import { formatMoney } from '../lib/utils';
import {
  filterItems,
  filterItemsIgnoreStatus,
  filterSummary,
  formatMonthLabel,
  groupByMonth,
  type ListFilter,
} from '../lib/listFilter';
import ActionMenu, { type Action } from './ActionMenu';
import ConfirmDialog from './ConfirmDialog';
import ListFilterBar from './ListFilterBar';
import { useFilterSummaryText } from '../hooks/useFilterSummaryText';

type Props = {
  filter: ListFilter;
  onFilterChange: (next: Partial<ListFilter>) => void;
  onFilterClear: () => void;
  expandedMonths: Set<string>;
  onExpandedChange: (months: Set<string>) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
  autoWaitId?: number | null;
  onAutoWaitConsumed?: () => void;
};

const GRID_COLS =
  'grid-cols-[minmax(200px,1.5fr)_minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] ' +
  'lg:grid-cols-[minmax(200px,1.5fr)_minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] ' +
  'xl:grid-cols-[minmax(200px,1.5fr)_minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]';

function issueMatchKeyword(r: IssueSummary, kw: string): boolean {
  return [r.issue_number, r.invoice_number, r.customer_name, r.remarks].some(
    (v) => v && v.toLowerCase().includes(kw)
  );
}

function issueMatchStatus(r: IssueSummary, status: string): boolean {
  return r.status === status;
}

type PdfState = 'idle' | 'generating' | 'regenerate' | 'download';

export default function IssueList({
  filter,
  onFilterChange,
  onFilterClear,
  expandedMonths,
  onExpandedChange,
  onCreate,
  onEdit,
  autoWaitId,
  onAutoWaitConsumed,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['issues'],
    queryFn: issuesApi.list,
  });

  const statusOptions = [
    { value: 'all', label: t('issue.status_all') },
    { value: 'open', label: t('issue.status_open') },
    { value: 'paid', label: t('issue.status_paid') },
  ];

  const statusLabels: Record<string, string> = {
    open: t('issue.status_open'),
    paid: t('issue.status_paid'),
  };

  const [deleting, setDeleting] = useState<IssueSummary | null>(null);
  const [pdfStates, setPdfStates] = useState<Record<number, PdfState>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const filtered = useMemo(
    () => filterItems(data, filter, issueMatchKeyword, issueMatchStatus),
    [data, filter]
  );
  const baseFiltered = useMemo(
    () => filterItemsIgnoreStatus(data, filter, issueMatchKeyword),
    [data, filter]
  );
  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    queryClient.invalidateQueries({ queryKey: ['stock'] });
  };

  const deleteMutation = useMutation({
    mutationFn: issuesApi.remove,
    onSuccess: () => {
      invalidate();
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

  // filter 变化或首次挂载时，如果没有任何已展开的月份出现在当前结果中，自动展开最新月份
  useEffect(() => {
    if (grouped.length === 0) return;
    const hasVisible = grouped.some((g) => expandedMonths.has(g.month));
    if (!hasVisible) {
      onExpandedChange(new Set([grouped[0].month]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function setPdfState(id: number, state: PdfState) {
    if (!mountedRef.current) return;
    setPdfStates((prev) => ({ ...prev, [id]: state }));
  }

  function getPdfState(r: IssueSummary): PdfState {
    if (r.invoice_pdf_path) return 'download';
    return pdfStates[r.id] ?? 'idle';
  }

  async function triggerPdf(r: IssueSummary) {
    setPdfState(r.id, 'generating');
    try {
      const res = await issuesApi.regenerateInvoice(r.id);
      if (res.status === 'ready') {
        setPdfState(r.id, 'download');
        queryClient.invalidateQueries({ queryKey: ['issues'] });
        return;
      }
      await waitForInvoicePdf(
        r.id,
        () => {
          setPdfState(r.id, 'download');
          queryClient.invalidateQueries({ queryKey: ['issues'] });
        },
        () => setPdfState(r.id, 'regenerate')
      );
    } catch {
      setPdfState(r.id, 'regenerate');
    }
  }

  function handlePdfClick(r: IssueSummary) {
    const state = getPdfState(r);
    if (state === 'download') {
      window.location.href = issuesApi.invoicePdfUrl(r.id);
      return;
    }
    if (state === 'generating') return;
    triggerPdf(r);
  }

  useEffect(() => {
    if (!autoWaitId) return;
    setPdfState(autoWaitId, 'generating');
    waitForInvoicePdf(
      autoWaitId,
      () => {
        setPdfState(autoWaitId, 'download');
        queryClient.invalidateQueries({ queryKey: ['issues'] });
      },
      () => setPdfState(autoWaitId, 'regenerate')
    ).finally(() => {
      onAutoWaitConsumed?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWaitId]);

  function actionsFor(r: IssueSummary): Action[] {
    return [
      { key: 'edit', label: t('common.edit'), onSelect: () => onEdit(r.id) },
      {
        key: 'delete',
        label: t('common.delete'),
        danger: true,
        onSelect: () => setDeleting(r),
      },
    ];
  }

  function pdfLabel(state: PdfState): string {
    switch (state) {
      case 'download':
        return t('issue.pdf_download');
      case 'generating':
        return t('issue.pdf_generating');
      case 'regenerate':
        return t('issue.pdf_regenerate');
      default:
        return t('issue.pdf_generate');
    }
  }

  function renderPdfButton(r: IssueSummary) {
    const state = getPdfState(r);
    const disabled = state === 'generating';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePdfClick(r);
        }}
        disabled={disabled}
        className={
          'h-9 px-2.5 text-xs rounded-md border ' +
          (state === 'download'
            ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
            : state === 'generating'
            ? 'border-slate-200 text-slate-400 cursor-not-allowed'
            : 'border-slate-900 text-slate-900 hover:bg-slate-100')
        }
      >
        {pdfLabel(state)}
      </button>
    );
  }

  function isPaid(r: IssueSummary) {
    return r.status === 'paid';
  }

  const emptySummary = useFilterSummaryText(filterSummary(filter, statusOptions));

  return (
    <div className="space-y-4">
      <ListFilterBar
        filter={filter}
        onChange={patchFilter}
        onClear={clearFilter}
        statusOptions={statusOptions}
        searchPlaceholder={t('filter.search_issues')}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading ? t('common.loading') : t('issue.count', { count: filtered.length })}
        </p>
        <button
          onClick={onCreate}
          className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
        >
          + {t('issue.new')}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('issue.empty_hint')}
        </div>
      )}

      {!isLoading && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('issue.no_match', { summary: emptySummary })}
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
                {t('issue.number')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                {t('issue.date')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                {t('issue.customer_section')}
              </div>
              <div role="columnheader" className="hidden xl:block px-3 py-2 text-left">
                {t('issue.invoice_number')}
              </div>
              <div role="columnheader" className="hidden lg:block px-3 py-2 text-right">
                {t('issue.column_gross_net')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-center">
                {t('issue.column_pdf')}
              </div>
              <div role="columnheader" className="hidden lg:block px-3 py-2 text-center">
                {t('issue.remarks')}
              </div>
              <div role="columnheader" className="px-3 py-2 text-center">
                {t('common.actions')}
              </div>
            </div>

            {/* 月份分组 */}
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
                    group.items.map((r) => {
                      const paid = isPaid(r);
                      return (
                        <div
                          key={r.id}
                          role="row"
                          onClick={() => onEdit(r.id)}
                          className={`grid ${GRID_COLS} border-t border-slate-100 hover:bg-slate-50 cursor-pointer text-sm`}
                        >
                          {/* 单号 */}
                          <div
                            role="cell"
                            className={
                              'px-3 py-2 font-medium border-l-4 ' +
                              (paid
                                ? 'border-l-green-500'
                                : 'border-l-amber-500')
                            }
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={
                                  'truncate ' + (paid ? '' : 'text-amber-700')
                                }
                                title={statusLabels[r.status] ?? r.status}
                              >
                                {r.issue_number}
                              </span>
                              {r.is_export === 1 && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {t('issue.export_badge')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 日期 */}
                          <div role="cell" className="px-3 py-2 whitespace-nowrap">
                            {r.date}
                          </div>

                          {/* 客户 */}
                          <div role="cell" className="px-3 py-2 min-w-0">
                            <div className="truncate" title={r.customer_name ?? ''}>
                              {r.customer_name ?? '—'}
                            </div>
                          </div>

                          {/* 发票号（xl） */}
                          <div role="cell" className="hidden xl:block px-3 py-2 min-w-0">
                            <div className="truncate" title={r.invoice_number ?? ''}>
                              {r.invoice_number ?? '—'}
                            </div>
                          </div>

                          {/* 含税/净额（lg+） */}
                          <div role="cell" className="hidden lg:block px-3 py-2 text-right">
                            <div className="font-medium">
                              {formatMoney(r.gross_total)} €
                            </div>
                            <div className="text-xs text-slate-500">
                              {t('issue.amount_net')} {formatMoney(r.net_total)} €
                            </div>
                          </div>

                          {/* PDF */}
                          <div role="cell" className="px-3 py-2 text-center">
                            {renderPdfButton(r)}
                          </div>

                          {/* 备注（lg+） */}
                          <div role="cell" className="hidden lg:block px-3 py-2 text-center min-w-0">
                            <div className="truncate" title={r.remarks ?? ''}>
                              {r.remarks || '—'}
                            </div>
                          </div>

                          {/* 操作 */}
                          <div role="cell" className="px-3 py-2 text-center">
                            <div className="inline-flex justify-center">
                              <ActionMenu
                                actions={actionsFor(r)}
                                contextLabel={r.issue_number}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      {group.items.map((r) => {
                        const paid = isPaid(r);
                        return (
                          <li
                            key={r.id}
                            className={
                              'relative rounded-lg border border-slate-200 bg-white border-l-4 ' +
                              (paid ? 'border-l-green-500' : 'border-l-amber-500')
                            }
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => onEdit(r.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onEdit(r.id);
                                }
                              }}
                              className="w-full text-left p-3 pr-14 cursor-pointer hover:bg-slate-50 active:bg-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {r.issue_number}
                                </span>
                                {r.is_export === 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                    {t('issue.export_badge')}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 truncate">
                                {r.date} · {r.customer_name ?? '—'}
                              </div>
                              <div className="text-sm text-slate-700 mt-1">
                                {t('issue.amount_gross')}{' '}
                                <span className="font-medium">
                                  {formatMoney(r.gross_total)} €
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  · {t('issue.amount_net')} {formatMoney(r.net_total)} €
                                </span>
                              </div>
                              <div className="text-xs mt-0.5">
                                <span
                                  className={paid ? 'text-green-700' : 'text-amber-700'}
                                >
                                  {statusLabels[r.status] ?? r.status}
                                </span>
                              </div>
                            </div>
                            <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between">
                              {renderPdfButton(r)}
                              <span className="text-xs text-slate-400">
                                {r.invoice_number ?? ''}
                              </span>
                            </div>
                            <div className="absolute top-1 right-1">
                              <ActionMenu
                                actions={actionsFor(r)}
                                contextLabel={r.issue_number}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('issue.delete_title')}
        message={
          deleting
            ? t('issue.delete_confirm', { number: deleting.issue_number })
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
          {t('issue.delete_failed', { error: String(deleteMutation.error) })}
        </p>
      )}
    </div>
  );
}