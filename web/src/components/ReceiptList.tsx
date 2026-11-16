import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { receiptsApi, type ReceiptSummary } from '../api/receipts';
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

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'unused', label: '未使用' },
  { value: 'used', label: '已使用' },
];

const GRID_COLS =
  'grid-cols-[minmax(200px,1.5fr)_minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] ' +
  'lg:grid-cols-[minmax(200px,1.5fr)_minmax(90px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]';

function receiptMatchKeyword(r: ReceiptSummary, kw: string): boolean {
  return [r.receipt_number, r.supplier, r.supplier_invoice, r.remarks].some(
    (v) => v && v.toLowerCase().includes(kw)
  );
}

function receiptMatchStatus(r: ReceiptSummary, status: string): boolean {
  if (status === 'used') return r.is_used === 1;
  if (status === 'unused') return r.is_used === 0;
  return true;
}

export default function ReceiptList({
  filter,
  onFilterChange,
  onFilterClear,
  expandedMonths,
  onExpandedChange,
  onCreate,
  onEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['receipts'],
    queryFn: receiptsApi.list,
  });

  const [deleting, setDeleting] = useState<ReceiptSummary | null>(null);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const filtered = useMemo(
    () => filterItems(data, filter, receiptMatchKeyword, receiptMatchStatus),
    [data, filter]
  );
  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const deleteMutation = useMutation({
    mutationFn: receiptsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
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

  function actionsFor(r: ReceiptSummary): Action[] {
    return [
      { key: 'edit', label: '编辑', onSelect: () => onEdit(r.id) },
      { key: 'delete', label: '删除', danger: true, onSelect: () => setDeleting(r) },
    ];
  }

  const emptySummary = filterSummary(filter, statusOptions);

  return (
    <div className="space-y-4">
      <ListFilterBar
        filter={filter}
        onChange={patchFilter}
        onClear={clearFilter}
        statusOptions={statusOptions}
        searchPlaceholder="搜索单号、供应商、发票号、备注..."
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500 shrink-0">
          {isLoading ? '加载中…' : `共 ${filtered.length} 张进货单`}
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
            <span className="hidden sm:inline">扫描账单</span>
          </button>
          <ScanTaskBell onClick={() => setTaskDrawerOpen(true)} />
          <button
            onClick={onCreate}
            className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            <span className="hidden sm:inline">+ 新建进货单</span>
            <span className="sm:hidden">+ 新建</span>
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">加载失败：{String(error)}</p>}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          暂无进货单，点击右上角「新建进货单」开始。
        </div>
      )}

      {!isLoading && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          没有匹配「{emptySummary}」的单据。
          <button
            onClick={clearFilter}
            className="ml-2 text-slate-700 underline hover:text-slate-900"
          >
            清除筛选
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* 桌面表格：Grid + minmax */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
            {/* 表头 */}
            <div
              role="row"
              className={`grid ${GRID_COLS} bg-slate-100 text-slate-600 text-sm`}
            >
              <div role="columnheader" className="px-3 py-2 text-left">
                单号
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                日期
              </div>
              <div role="columnheader" className="px-3 py-2 text-left">
                供应商
              </div>
              <div
                role="columnheader"
                className="hidden lg:block px-3 py-2 text-right"
              >
                明细
              </div>
              <div role="columnheader" className="px-3 py-2 text-right">
                含税 / 净额
              </div>
              <div
                role="columnheader"
                className="hidden lg:block px-3 py-2 text-center"
              >
                备注
              </div>
              <div role="columnheader" className="px-3 py-2 text-center">
                操作
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
                    {formatMonthLabel(group.month)} ({group.items.length})
                  </div>

                  {expanded &&
                    group.items.map((r) => {
                      const isUsed = r.is_used === 1;
                      return (
                        <div
                          key={r.id}
                          role="row"
                          onClick={() => onEdit(r.id)}
                          className={`grid ${GRID_COLS} border-t border-slate-100 hover:bg-slate-50 cursor-pointer text-sm`}
                        >
                          {/* 单号：已用蓝色条，未使用灰色条 */}
                          <div
                            role="cell"
                            className={
                              'px-3 py-2 font-medium border-l-4 ' +
                              (isUsed
                                ? 'border-l-blue-500'
                                : 'border-l-slate-300')
                            }
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate" title={r.receipt_number}>
                                {r.receipt_number}
                              </span>
                              {isUsed && (
                                <span
                                  className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700"
                                  title="已被销售单引用，无法删除"
                                >
                                  已用
                                </span>
                              )}
                              {r.needs_review === 1 && (
                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                  待核对
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 日期 */}
                          <div role="cell" className="px-3 py-2 whitespace-nowrap">
                            {r.date}
                          </div>

                          {/* 供应商 */}
                          <div role="cell" className="px-3 py-2 min-w-0">
                            <div className="truncate" title={r.supplier ?? ''}>
                              {r.supplier ?? '—'}
                            </div>
                          </div>

                          {/* 明细（lg+） */}
                          <div
                            role="cell"
                            className="hidden lg:block px-3 py-2 text-right"
                          >
                            {r.item_count}
                          </div>

                          {/* 含税/净额 */}
                          <div role="cell" className="px-3 py-2 text-right">
                            <div className="font-medium">
                              {formatMoney(r.gross_total)} €
                            </div>
                            <div className="text-xs text-slate-500">
                              净 {formatMoney(r.net_total)} €
                            </div>
                          </div>

                          {/* 备注（lg+） */}
                          <div
                            role="cell"
                            className="hidden lg:block px-3 py-2 text-center min-w-0"
                          >
                            <div className="truncate" title={r.remarks ?? ''}>
                              {r.remarks || '—'}
                            </div>
                          </div>

                          {/* 操作 */}
                          <div role="cell" className="px-3 py-2 text-center">
                            <div className="inline-flex justify-center">
                              <ActionMenu
                                actions={actionsFor(r)}
                                contextLabel={r.receipt_number}
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
                      {formatMonthLabel(group.month)} ({group.items.length})
                    </span>
                    <span className="text-slate-400">
                      {expanded ? '▾' : '▸'}
                    </span>
                  </div>
                  {expanded && (
                    <ul className="space-y-2 mt-2">
                      {group.items.map((r) => {
                        const isUsed = r.is_used === 1;
                        return (
                          <li
                            key={r.id}
                            className={
                              'relative rounded-lg border border-slate-200 bg-white border-l-4 ' +
                              (isUsed
                                ? 'border-l-blue-500'
                                : 'border-l-slate-300')
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
                                  {r.receipt_number}
                                </span>
                                {isUsed && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                    已用
                                  </span>
                                )}
                                {r.needs_review === 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                    待核对
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 truncate">
                                {r.date} · {r.supplier ?? '—'}
                              </div>
                              <div className="text-sm text-slate-700 mt-1">
                                含税{' '}
                                <span className="font-medium">
                                  {formatMoney(r.gross_total)} €
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  · 净 {formatMoney(r.net_total)} €
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {r.item_count} 项
                              </div>
                            </div>
                            <div className="absolute top-1 right-1">
                              <ActionMenu
                                actions={actionsFor(r)}
                                contextLabel={r.receipt_number}
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

      <ScanUploadDialog
        open={scanDialogOpen}
        targetType="receipt"
        onClose={() => setScanDialogOpen(false)}
        onUploaded={() => setScanDialogOpen(false)}
      />
      <ScanTaskDrawer
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="删除进货单"
        message={
          deleting
            ? `确定删除进货单「${deleting.receipt_number}」？此操作不可撤销。`
            : ''
        }
        confirmLabel="删除"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />

      {deleteMutation.error && (
        <p className="text-sm text-red-600">
          删除失败：{String(deleteMutation.error)}
        </p>
      )}
    </div>
  );
}