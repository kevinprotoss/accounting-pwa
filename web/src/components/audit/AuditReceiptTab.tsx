import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { auditApi, type AuditReceiptSummary } from '../../api/audit';
import { monthsAgo, todayStr } from '../../lib/listFilter';
import { formatMoney } from '../../lib/utils';

const PAGE_SIZE = 50;
const inputClass =
  'w-full h-10 rounded-md border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

export default function AuditReceiptTab() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(todayStr());
  const [supplier, setSupplier] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-receipts', from, to, supplier, page],
    queryFn: () =>
      auditApi.receipts({
        from: from || undefined,
        to: to || undefined,
        supplier: supplier || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  if (selectedId !== null) {
    return <ReceiptDetail id={selectedId} onClose={() => setSelectedId(null)} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('filter.start_date')}
            </span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('filter.end_date')}
            </span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('audit.receipt_search_supplier')}
            </span>
            <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder={t('audit.fuzzy_match')} className={inputClass} />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage(0)}
            className="h-10 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            {t('common.search')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom(monthsAgo(3));
              setTo(todayStr());
              setSupplier('');
              setPage(0);
            }}
            className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {isLoading ? t('common.loading') : t('audit.receipt_count', { count: total })}
      </p>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && total === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('audit.receipt_empty')}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">{t('audit.receipt_number')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.receipt_date')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.receipt_supplier')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_item_count')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_net_total')}</th>
                  <th className="px-3 py-2 text-center w-24">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{it.receipt_number}</td>
                    <td className="px-3 py-2">{it.date}</td>
                    <td className="px-3 py-2">{it.supplier ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{it.item_count}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.net_total)} €</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedId(it.id)}
                        className="h-8 px-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        {t('audit.receipt_action_view_detail')}
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
                <div className="font-medium truncate">{it.receipt_number}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {it.date} · {it.supplier ?? '—'}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  {it.item_count} {t('audit.receipt_item_count')} · {t('audit.receipt_net_total')} {formatMoney(it.net_total)} €
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className="mt-2 h-9 px-3 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  {t('audit.receipt_action_view_detail')}
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
                {t('common.prev_page')}
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
                {t('common.next_page')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReceiptDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-receipt-detail', id],
    queryFn: () => auditApi.receiptDetail(id),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex items-center justify-center md:left-56">
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-3 md:left-56">
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
        <button onClick={onClose} className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
          {t('common.back_to_list')}
        </button>
      </div>
    );
  }

  const { receipt, items, usedBy } = data;
  const netTotal = items.reduce((s, it) => s + it.net_unit_price * it.quantity, 0);

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold truncate">
          {t('audit.receipt_detail_title', { number: receipt.receipt_number })}
        </h2>
        <button onClick={onClose} className="h-11 px-3 text-sm text-slate-600 hover:underline shrink-0">
          {t('common.back_to_list')}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t('audit.receipt_info_section')}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label={t('audit.receipt_number')} value={receipt.receipt_number} />
              <Row label={t('audit.receipt_date')} value={receipt.date} />
              <Row label={t('audit.receipt_supplier')} value={receipt.supplier ?? '—'} />
              <Row label={t('audit.receipt_supplier_invoice')} value={receipt.supplier_invoice ?? '—'} />
            </dl>
            {receipt.remarks && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  {t('audit.receipt_remarks')}
                </div>
                <div className="text-sm text-slate-700">{receipt.remarks}</div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('audit.receipt_items_section')}
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">{t('audit.receipt_product_name')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_quantity')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_net_unit_price')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_tax_rate')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.receipt_subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{it.product_name}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.net_unit_price)} €</td>
                    <td className="px-3 py-2 text-right">{it.tax_rate}%</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.net_unit_price * it.quantity)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-200 text-right text-sm">
              <span className="text-slate-600 mr-3">{t('audit.receipt_total_net')}</span>
              <span className="font-semibold">{formatMoney(netTotal)} €</span>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('audit.receipt_used_by_section', { count: usedBy.length })}
              </h3>
            </div>
            {usedBy.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t('audit.receipt_used_by_none')}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {usedBy.map((u) => (
                  <li key={u.issue_id} className="px-4 py-2 flex justify-between text-sm">
                    <span className="font-medium">{u.issue_number}</span>
                    <span className="text-slate-500">
                      {u.date} · {u.customer_name ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
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