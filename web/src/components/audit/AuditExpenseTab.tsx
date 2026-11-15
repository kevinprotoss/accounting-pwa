import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditExpense } from '../../api/audit';
import { monthsAgo, todayStr } from '../../lib/listFilter';
import { formatMoney } from '../../lib/utils';

const PAGE_SIZE = 50;
const inputClass =
  'w-full h-10 rounded-md border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

export default function AuditExpenseTab() {
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(todayStr());
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditExpense | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-expenses', from, to, category, page],
    queryFn: () =>
      auditApi.expenses({
        from: from || undefined,
        to: to || undefined,
        category: category || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  if (selected) {
    return <ExpenseDetail expense={selected} onClose={() => setSelected(null)} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">起始日期</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">结束日期</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">分类</span>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="模糊匹配" className={inputClass} />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage(0)}
            className="h-10 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom(monthsAgo(3));
              setTo(todayStr());
              setCategory('');
              setPage(0);
            }}
            className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            重置
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {isLoading ? '加载中…' : `共 ${total} 条支出`}
      </p>

      {error && <p className="text-sm text-red-600">加载失败：{String(error)}</p>}

      {!isLoading && total === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          没有匹配条件的支出。
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">日期</th>
                  <th className="px-3 py-2 text-left">分类</th>
                  <th className="px-3 py-2 text-left">描述</th>
                  <th className="px-3 py-2 text-right">净额</th>
                  <th className="px-3 py-2 text-right">税额</th>
                  <th className="px-3 py-2 text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{it.date}</td>
                    <td className="px-3 py-2">{it.category ?? '—'}</td>
                    <td className="px-3 py-2 truncate max-w-[240px]">{it.description ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.net_amount)} €</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.input_tax)} €</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelected(it)}
                        className="h-8 px-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {items.map((it) => (
              <li key={it.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-medium truncate">{it.category ?? it.description ?? '—'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {it.date} · {it.description ?? '—'}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  净额 {formatMoney(it.net_amount)} € · 税 {formatMoney(it.input_tax)} €
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(it)}
                  className="mt-2 h-9 px-3 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  查看详情
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-sm text-slate-500">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExpenseDetail({ expense, onClose }: { expense: AuditExpense; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold truncate">支出详情</h2>
        <button onClick={onClose} className="h-11 px-3 text-sm text-slate-600 hover:underline shrink-0">
          返回列表
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="日期" value={expense.date} />
              <Row label="分类" value={expense.category ?? '—'} />
              <Row label="描述" value={expense.description ?? '—'} />
              <Row label="类型" value={expense.is_output_tax ? '销项' : '进项'} />
              <Row label="净额" value={`${formatMoney(expense.net_amount)} €`} />
              <Row label="税率" value={`${expense.tax_rate}%`} />
              <Row label="税额" value={`${formatMoney(expense.input_tax)} €`} />
              <Row label="供应商发票号" value={expense.supplier_invoice ?? '—'} />
            </dl>
            {expense.remarks && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">备注</div>
                <div className="text-sm text-slate-700">{expense.remarks}</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 text-right break-all">{value}</dd>
    </div>
  );
}