import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { auditApi } from '../../api/audit';
import { formatMoney } from '../../lib/utils';

const actionLabels: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
};

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
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-issue-chain', issueId],
    queryFn: () => auditApi.issueChain(issueId),
  });

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
        <p className="text-sm text-slate-500">加载中…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-3 md:left-56">
        <p className="text-sm text-red-600">加载失败：{String(error)}</p>
        <button
          onClick={onClose}
          className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          返回列表
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
          链路追溯：{issue.issue_number}
        </h2>
        <button
          onClick={onClose}
          className="h-11 px-3 text-sm text-slate-600 hover:underline shrink-0"
        >
          返回列表
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {/* 销售信息 */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">销售信息</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="单号" value={issue.issue_number} />
              <Row label="日期" value={issue.date} />
              <Row label="客户" value={issue.customer_name ?? '—'} />
              <Row label="发票号" value={issue.invoice_number ?? '—'} />
              <Row label="状态" value={issue.status === 'paid' ? '已付款' : '待付款'} />
              <Row label="出口" value={issue.is_export ? '是' : '否'} />
              <Row label="承运商" value={issue.carrier ?? '—'} />
              <Row label="跟踪号" value={issue.tracking_number ?? '—'} />
              <Row label="发货日期" value={issue.shipping_date ?? '—'} />
              {issue.is_export === 1 && (
                <>
                  <Row label="报关号" value={issue.export_customs_number ?? '—'} />
                  <Row label="报关日期" value={issue.export_customs_date ?? '—'} />
                  <Row label="出口地点" value={issue.export_location ?? '—'} />
                </>
              )}
              <Row label="付款到账日" value={issue.payment_received_date ?? '—'} />
              <Row label="银行参考" value={issue.bank_reference ?? '—'} />
            </dl>
            {issue.customer_address && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">客户地址</div>
                <div className="text-sm whitespace-pre-line text-slate-700">
                  {issue.customer_address}
                </div>
              </div>
            )}
            {issue.remarks && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-medium text-slate-500 mb-1">备注</div>
                <div className="text-sm text-slate-700">{issue.remarks}</div>
              </div>
            )}
          </section>

          {/* 发票 */}
          {invoice && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">发票</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row label="发票号" value={invoice.invoice_number} />
                <Row
                  label="净额"
                  value={invoice.net_total != null ? `${formatMoney(invoice.net_total)} €` : '—'}
                />
                <Row
                  label="税额"
                  value={invoice.tax_total != null ? `${formatMoney(invoice.tax_total)} €` : '—'}
                />
                <Row
                  label="总额"
                  value={invoice.gross_total != null ? `${formatMoney(invoice.gross_total)} €` : '—'}
                />
              </dl>
              <div className="mt-3">
                {invoice.pdf_path ? (
                  <a
                    href={`/api/issues/${issueId}/invoice.pdf`}
                    className="inline-flex h-9 px-3 items-center text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    下载发票 PDF
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">PDF 尚未生成</span>
                )}
              </div>
            </section>
          )}

          {/* 商品明细 */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">商品明细</h3>
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
                        <span className="md:hidden text-xs text-slate-500">数量 </span>
                        {it.quantity}
                      </div>
                      <div className="text-right text-slate-600">
                        <span className="md:hidden text-xs text-slate-500">售价 </span>
                        {formatMoney(it.selling_net_price)} €
                      </div>
                      <div className="text-right text-slate-600">
                        <span className="md:hidden text-xs text-slate-500">进价 </span>
                        {formatMoney(it.purchase_price)} €
                      </div>
                      <div className="text-right font-medium">
                        <span className="md:hidden text-xs text-slate-500">利润 </span>
                        {formatMoney(lineProfit)} €
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleReceipt(it.id)}
                      className="mt-2 text-xs text-slate-600 hover:text-slate-900 underline"
                    >
                      {expanded ? '收起进货批次' : '查看进货批次'}
                    </button>
                    {expanded && (
                      <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs space-y-1">
                        <div>
                          <span className="text-slate-500">供应商：</span>
                          {it.supplier ?? '—'}
                        </div>
                        <div>
                          <span className="text-slate-500">进货单号：</span>
                          {it.receipt_number}
                        </div>
                        <div>
                          <span className="text-slate-500">进货日期：</span>
                          {it.receipt_date}
                        </div>
                        <div>
                          <span className="text-slate-500">供应商发票号：</span>
                          {it.supplier_invoice ?? '—'}
                        </div>
                        <div>
                          <span className="text-slate-500">税率：</span>
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
                <span className="text-slate-500 mr-2">净额合计</span>
                <span className="font-medium">{formatMoney(totalNet)} €</span>
              </div>
              <div>
                <span className="text-slate-500 mr-2">利润合计</span>
                <span className="font-medium">{formatMoney(totalProfit)} €</span>
              </div>
            </div>
          </section>

          {/* 变更历史 */}
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                变更历史（{history.length}）
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">无变更记录。</div>
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
                                旧值
                              </div>
                              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-48">
                                {formatJson(h.old_values)}
                              </pre>
                            </div>
                          )}
                          {h.new_values && (
                            <div>
                              <div className="text-xs font-medium text-slate-500 mb-1">
                                新值
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