import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { taxApi } from '../api/tax';
import { carsApi } from '../api/cars';
import { formatMoney } from '../lib/utils';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

function defaultRange() {
  const now = new Date();
  const year = now.getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const granularityOptions = [
  { value: 'month', label: '按月' },
  { value: 'quarter', label: '按季度' },
  { value: 'year', label: '按年度' },
];

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? 'font-semibold text-slate-900' : 'text-slate-700'}>
        {value}
      </span>
    </div>
  );
}

export default function TaxPage() {
  const queryClient = useQueryClient();
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [granularity, setGranularity] = useState<'month' | 'quarter' | 'year'>('quarter');

  useEffect(() => {
    carsApi
      .ensureExpenses()
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['tax'] });
      })
      .catch(() => {});
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tax', from, to, granularity],
    queryFn: () => taxApi.report(from, to, granularity),
  });

  function handleExport() {
    const url = taxApi.elsterUrl(from, to, granularity);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">起始日期</span>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">结束日期</span>
            <input
              type="date"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">汇总粒度</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
            {granularityOptions.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGranularity(g.value as typeof granularity)}
                className={
                  'h-10 px-3 text-sm ' +
                  (granularity === g.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100')
                }
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleExport}
            disabled={!data || data.periods.length === 0}
            className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            导出 ELSTER TXT
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && <p className="text-sm text-red-600">加载失败：{String(error)}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard title="国内销售">
              <Line label="净额" value={`${formatMoney(data.summary.domesticNet)} €`} />
              <Line label="销项税" value={`${formatMoney(data.summary.domesticTax)} €`} />
            </SummaryCard>
            <SummaryCard title="出口销售">
              <Line label="净额（0%）" value={`${formatMoney(data.summary.exportNet)} €`} />
            </SummaryCard>
            <SummaryCard title="进项税合计">
              <Line
                label="进货"
                value={`${formatMoney(data.summary.inputTaxPurchase)} €`}
              />
              <Line
                label="其他支出"
                value={`${formatMoney(data.summary.inputTaxExpense)} €`}
              />
              <Line label="合计" value={`${formatMoney(data.summary.inputTax)} €`} strong />
            </SummaryCard>
            <SummaryCard title="应缴增值税（Zahllast）">
              <div
                className={`text-2xl font-bold ${
                  data.summary.vatPayable >= 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatMoney(Math.abs(data.summary.vatPayable))} €
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {data.summary.vatPayable >= 0 ? '需缴纳' : '可退税'}
              </div>
              {data.summary.additionalTax > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  含附加销项税 {formatMoney(data.summary.additionalTax)} €
                </div>
              )}
            </SummaryCard>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {granularity === 'month'
                  ? '按月汇总'
                  : granularity === 'quarter'
                  ? '按季度汇总'
                  : '按年度汇总'}
              </h3>
            </div>

            {data.periods.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">所选期间没有数据。</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">期间</th>
                        <th className="px-4 py-2 text-right">国内净额</th>
                        <th className="px-4 py-2 text-right">销项税</th>
                        <th className="px-4 py-2 text-right">出口净额</th>
                        <th className="px-4 py-2 text-right">进项税</th>
                        <th className="px-4 py-2 text-right">附加销项税</th>
                        <th className="px-4 py-2 text-right">Zahllast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods.map((p) => (
                        <tr key={p.key} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium">{p.label}</td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(p.domesticNet)} €
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(p.domesticTax)} €
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(p.exportNet)} €
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(p.inputTax)} €
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(p.additionalTax)} €
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              p.vatPayable >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {formatMoney(p.vatPayable)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden divide-y divide-slate-100">
                  {data.periods.map((p) => (
                    <li key={p.key} className="px-4 py-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium">{p.label}</span>
                        <span
                          className={`font-semibold ${
                            p.vatPayable >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {formatMoney(p.vatPayable)} €
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        国内净额 {formatMoney(p.domesticNet)} € · 销项税{' '}
                        {formatMoney(p.domesticTax)} €
                      </div>
                      <div className="text-xs text-slate-500">
                        出口净额 {formatMoney(p.exportNet)} € · 进项税{' '}
                        {formatMoney(p.inputTax)} €
                        {p.additionalTax > 0 &&
                          ` · 附加 ${formatMoney(p.additionalTax)} €`}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}