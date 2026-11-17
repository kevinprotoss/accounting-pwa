import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { auditApi, type AuditIssueSummary } from '../../api/audit';
import { monthsAgo, todayStr } from '../../lib/listFilter';
import { formatMoney } from '../../lib/utils';
import IssueChainDetail from './IssueChainDetail';

const PAGE_SIZE = 50;
const inputClass =
  'w-full h-10 rounded-md border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

export default function AuditIssueTab() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(todayStr());
  const [invoice, setInvoice] = useState('');
  const [customer, setCustomer] = useState('');
  const [product, setProduct] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-issues', from, to, invoice, customer, product, page],
    queryFn: () =>
      auditApi.issues({
        from: from || undefined,
        to: to || undefined,
        invoice: invoice || undefined,
        customer: customer || undefined,
        product: product || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  if (selectedId !== null) {
    return (
      <IssueChainDetail issueId={selectedId} onClose={() => setSelectedId(null)} />
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function reset() {
    setFrom(monthsAgo(3));
    setTo(todayStr());
    setInvoice('');
    setCustomer('');
    setProduct('');
    setPage(0);
  }

  function search() {
    setPage(0);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('audit.issue_search_invoice')}
            </span>
            <input type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder={t('audit.fuzzy_match')} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('audit.issue_search_customer')}
            </span>
            <input type="text" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={t('audit.fuzzy_match')} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('audit.issue_search_product')}
            </span>
            <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t('audit.issue_search_product_name')} className={inputClass} />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={search}
            className="h-10 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            {t('common.search')}
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading ? t('common.loading') : t('audit.issue_count', { count: total })}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && total === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('audit.issue_empty')}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">{t('audit.issue_number')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.issue_date')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.issue_customer')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.issue_invoice_number')}</th>
                  <th className="px-3 py-2 text-center">{t('audit.issue_export')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.issue_net_total')}</th>
                  <th className="px-3 py-2 text-center w-24">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{it.issue_number}</td>
                    <td className="px-3 py-2">{it.date}</td>
                    <td className="px-3 py-2">{it.customer_name ?? '—'}</td>
                    <td className="px-3 py-2">{it.invoice_number ?? '—'}</td>
                    <td className="px-3 py-2 text-center">{it.is_export ? t('audit.chain_yes') : '—'}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(it.net_total)} €</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedId(it.id)}
                        className="h-8 px-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        {t('audit.issue_action_view_chain')}
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
                <div className="font-medium truncate">{it.issue_number}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {it.date} · {it.customer_name ?? '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t('audit.issue_invoice_number')} {it.invoice_number ?? '—'}
                </div>
                <div className="text-sm text-slate-700 mt-1">
                  {t('audit.issue_net_total')} {formatMoney(it.net_total)} €
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className="mt-2 h-9 px-3 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  {t('audit.issue_action_view_chain')}
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