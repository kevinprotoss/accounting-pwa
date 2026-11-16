import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockApi, type StockItem } from '../api/stock';
import { formatMoney } from '../lib/utils';

export default function StockPage() {
  const { t } = useTranslation();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['stock'],
    queryFn: () => stockApi.list(),
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (s) =>
        s.product_name.toLowerCase().includes(q) ||
        (s.supplier ?? '').toLowerCase().includes(q) ||
        (s.supplier_invoice ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const summary = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    for (const s of filtered) {
      totalQty += s.remaining_qty;
      totalValue += s.remaining_qty * s.purchase_price;
    }
    return { count: filtered.length, totalQty, totalValue };
  }, [filtered]);

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1 md:max-w-sm">
          <input
            className={inputClass}
            placeholder={t('stock.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>
            {t('stock.summary_batches', { count: summary.count })}
          </span>
          <span>
            {t('stock.summary_total_remaining', { qty: summary.totalQty })}
          </span>
          <span>
            {t('stock.summary_stock_value', {
              value: formatMoney(summary.totalValue),
            })}
          </span>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('stock.empty_hint')}
        </div>
      )}

      {!isLoading && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('stock.no_match', { keyword: search })}
        </div>
      )}

      {/* 桌面表格 */}
      {filtered.length > 0 && (
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">{t('stock.product_name')}</th>
                <th className="px-4 py-2 text-right">{t('stock.remaining')}</th>
                <th className="px-4 py-2 text-right">{t('stock.total')}</th>
                <th className="px-4 py-2 text-right">
                  {t('stock.purchase_price')}
                </th>
                <th className="px-4 py-2 text-right">{t('stock.tax_rate')}</th>
                <th className="px-4 py-2 text-left">{t('stock.receipt_date')}</th>
                <th className="px-4 py-2 text-left">{t('stock.supplier')}</th>
                <th className="px-4 py-2 text-left">
                  {t('stock.supplier_invoice')}
                </th>
                <th className="px-4 py-2 text-right">
                  {t('stock.remaining_value')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.receipt_item_id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{s.product_name}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900">
                    {s.remaining_qty}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {s.received_qty}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(s.purchase_price)} €
                  </td>
                  <td className="px-4 py-2 text-right">{s.tax_rate}%</td>
                  <td className="px-4 py-2">{s.receipt_date}</td>
                  <td className="px-4 py-2">{s.supplier ?? '—'}</td>
                  <td className="px-4 py-2">{s.supplier_invoice ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(s.remaining_qty * s.purchase_price)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 手机卡片 */}
      {filtered.length > 0 && (
        <ul className="md:hidden space-y-2">
          {filtered.map((s) => (
            <li
              key={s.receipt_item_id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="font-medium truncate">{s.product_name}</div>
              <div className="text-xs text-slate-500 mt-1">
                {t('stock.remaining')}{' '}
                <span className="font-medium text-slate-900">
                  {s.remaining_qty}
                </span>
                {' / '}
                {t('stock.total')} {s.received_qty}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {t('stock.purchase_price')} {formatMoney(s.purchase_price)} € ·{' '}
                {t('stock.tax_rate')} {s.tax_rate}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {s.receipt_date} · {s.supplier ?? '—'}
              </div>
              {s.supplier_invoice && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {t('stock.supplier_invoice')} {s.supplier_invoice}
                </div>
              )}
              <div className="text-xs text-slate-700 mt-1">
                {t('stock.remaining_value')}{' '}
                <span className="font-medium">
                  {formatMoney(s.remaining_qty * s.purchase_price)} €
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}