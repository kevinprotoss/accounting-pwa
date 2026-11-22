import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auditApi } from '../../api/audit';
import { formatMoney } from '../../lib/utils';

function formatJson(raw: string | null): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

type Props = {
  issueId: number;
  onClose: () => void;
};

export default function IssueChainDetail({ issueId, onClose }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-issue-chain', issueId],
    queryFn: () => auditApi.issueChain(issueId),
  });

  const actionLabels = useMemo<Record<string, string>>(
    () => ({
      create: t('audit.chain_history_create'),
      update: t('audit.chain_history_update'),
      delete: t('audit.chain_history_delete'),
    }),
    [t]
  );

  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());
  const [expandedReceipt, setExpandedReceipt] = useState<Set<number>>(new Set());

  function toggleHistory(id: number) {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleReceipt(id: number) {
    setExpandedReceipt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        <button
          onClick={onClose}
          className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          {t('common.back_to_list')}
        </button>
      </div>
    );
  }

  const { issue, items, invoice, history } = data;
  const totalNet = items.reduce(
    (s, it) => s + it.selling_net_price * it.quantity,
    0
  );
  const totalProfit = items.reduce(
    (s, it) => s + (it.selling_net_price - it.purchase_price) * it.quantity,
    0
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold truncate">
          {t('audit.chain_title', { number: issue.issue_number })}
        </h2>
        <button
          onClick={onClose}
          className="h-11 px-3 text-sm text-slate-600 hover:underline shrink-0"
        >
          {t('common.back_to_list')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {/* 销售信息 */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t('audit.chain_sales_info')}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label={t('audit.chain_number')} value={issue.issue_number} />
              <Row label={t('audit.chain_date')} value={issue.date} />
              <Row label={t('audit.chain_customer')} value={issue.customer_name ?? '—'} />
              <Row label={t('audit.chain_invoice_number')} value={issue.invoice_number ?? '—'} />
              <Row
                label={t('audit.chain_status')}
                value={issue.status === 'paid' ? t('audit.chain_status_paid') : t('audit.chain_status_open')}
              />
              <Row
                label={t('audit.chain_export')}
                value={issue.is_export ? t('audit.chain_yes') : t('audit.chain_no')}
              />
              <Row label={t('audit.chain_carrier')} value={issue.carrier ?? '—'} />
              <Row label={t('audit.chain_tracking_number')} value={issue.tracking_number ?? '—'} />
              <Row label={t('audit.chain_shipping_date')} value={issue.shipping_date ?? '—'} />
              {issue.is_export === 1 && (
                <>
                  <Row label={t('audit.chain_customs_number')} value={issue.export_customs_number ?? '—'} />
                  <Row label={t('audit.chain_customs_date')} value={issue.export_customs_date ?? '—'} />
                  <Row label={t('audit.chain_export_location')} value={issue.export_location ?? '—'} />
                </>
              )}
              <Row label={t('audit.chain_payment_received_date')} value={issue.payment_received_date ?? '—'} />
              <Row label={t('audit.chain_bank_reference')} value={issue.bank_reference ?? '—'} />
            </dl>
            {issue.customer_address && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  {t('audit.chain_customer_address')}
                </div>
                <div className="text-sm whitespace-pre-line text-slate-700">
                  {issue.customer_address}
                </div>
              </div>
            )}
            {issue.remarks && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  {t('audit.chain_remarks')}
                </div>
                <div className="text-sm text-slate-700">{issue.remarks}</div>
              </div>
            )}
          </section>

          {/* 发票 */}
          {invoice && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {t('audit.chain_invoice_section')}
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row label={t('audit.chain_invoice_number')} value={invoice.invoice_number} />
                <Row
                  label={t('audit.chain_net_total')}
                  value={invoice.net_total != null ? `${formatMoney(invoice.net_total)} €` : '—'}
                />
                <Row
                  label={t('audit.chain_tax_total')}
                  value={invoice.tax_total != null ? `${formatMoney(invoice.tax_total)} €` : '—'}
                />
                <Row
                  label={t('audit.chain_gross_total')}
                  value={invoice.gross_total != null ? `${formatMoney(invoice.gross_total)} €` : '—'}
                />
              </dl>
              <div className="mt-3">
                {invoice.pdf_path ? (
                  <a
                    href={`/api/issues/${issueId}/invoice.pdf`}
                    className="inline-flex h-9 px-3 items-center text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    {t('audit.chain_download_pdf')}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">
                    {t('audit.chain_pdf_not_ready')}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* 商品明细 */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('audit.chain_items_section')}
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const lineProfit =
                  (it.selling_net_price - it.purchase_price) * it.quantity;
                const expanded = expandedReceipt.has(it.id);
                return (
                  <div key={it.id} className="px-4 py-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div className="col-span-2 md:col-span-1 font-medium">
                        {it.product_name}
                      </div>
                      <div className="text-right text-slate-600">
                        <span className="md:hidden text-xs text-slate-500">{t('audit.chain_quantity')} </span>
                        {it.quantity}
                      </div>
                      <div className="text-right text-slate-600">
                        <span className="md:hidden text-xs text-slate-500">{t('audit.chain_selling_price')} </span>
                        {formatMoney(it.selling_net_price)} €
                      </div>
                      <div className="text-right text-slate-600">
                        <span className="md:hidden text-xs text-slate-500">{t('audit.chain_purchase_price')} </span>
                        {formatMoney(it.purchase_price)} €
                      </div>
                      <div className="text-right font-medium">
                        <span className="md:hidden text-xs text-slate-500">{t('audit.chain_profit')} </span>
                        {formatMoney(lineProfit)} €
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleReceipt(it.id)}
                      className="mt-2 text-xs text-slate-600 hover:text-slate-900 underline"
                    >
                      {expanded ? t('audit.chain_hide_batch') : t('audit.chain_view_batch')}
                    </button>
                    {expanded && (
                      <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs space-y-1">
                        <div>
                          <span className="text-slate-500">{t('audit.chain_supplier')}：</span>
                          {it.supplier ?? '—'}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('audit.chain_receipt_number')}：</span>
                          {it.receipt_number}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('audit.chain_receipt_date')}：</span>
                          {it.receipt_date}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('audit.chain_supplier_invoice')}：</span>
                          {it.supplier_invoice ?? '—'}
                        </div>
                        <div>
                          <span className="text-slate-500">{t('audit.chain_tax_rate')}：</span>
                          {it.tax_rate}%
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-6 text-sm">
              <div>
                <span className="text-slate-500 mr-2">{t('audit.chain_total_net')}</span>
                <span className="font-medium">{formatMoney(totalNet)} €</span>
              </div>
              <div>
                <span className="text-slate-500 mr-2">{t('audit.chain_total_profit')}</span>
                <span className="font-medium">{formatMoney(totalProfit)} €</span>
              </div>
            </div>
          </section>

          {/* 变更历史 */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('audit.chain_history_section', { count: history.length })}
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t('audit.chain_history_none')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((h) => {
                  const expanded = expandedHistory.has(h.id);
                  return (
                    <div key={h.id} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleHistory(h.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm">
                            <span className="font-medium">
                              {actionLabels[h.action] ?? h.action}
                            </span>
                            <span className="text-slate-500 ml-2">{h.timestamp}</span>
                          </div>
                          <span className="text-slate-400 shrink-0">
                            {expanded ? '▾' : '▸'}
                          </span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="mt-2 space-y-2">
                          {h.old_values && (
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">
                                {t('audit.chain_history_old')}
                              </div>
                              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-48">
                                {formatJson(h.old_values)}
                              </pre>
                            </div>
                          )}
                          {h.new_values && (
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">
                                {t('audit.chain_history_new')}
                              </div>
                              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-48">
                                {formatJson(h.new_values)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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