import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm gap-2">
      <span className="text-slate-600 min-w-0 truncate" title={label}>
        {label}
      </span>
      <span
        className={
          'whitespace-nowrap shrink-0 ' +
          (strong ? 'font-semibold text-slate-900' : 'text-slate-700')
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function TaxPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [granularity, setGranularity] = useState<'month' | 'quarter' | 'year'>(
    'quarter'
  );

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

  const granularityOptions = [
    { value: 'month', label: t('tax.by_month') },
    { value: 'quarter', label: t('tax.by_quarter') },
    { value: 'year', label: t('tax.by_year') },
  ];

  const summaryTitle =
    granularity === 'month'
      ? t('tax.monthly_summary')
      : granularity === 'quarter'
      ? t('tax.quarterly_summary')
      : t('tax.yearly_summary');

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
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('tax.start_date')}
            </span>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              {t('tax.end_date')}
            </span>
            <input
              type="date"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {t('tax.granularity')}
          </span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
            {granularityOptions.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() =>
                  setGranularity(g.value as typeof granularity)
                }
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
            {t('tax.export_elster')}
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard title={t('tax.domestic_sales')}>
              <Line
                label={t('tax.net')}
                value={`${formatMoney(data.summary.domesticNet)} €`}
              />
              <Line
                label={t('tax.output_tax')}
                value={`${formatMoney(data.summary.domesticTax)} €`}
              />
            </SummaryCard>
            <SummaryCard title={t('tax.export_sales')}>
              <Line
                label={t('tax.export_net_zero')}
                value={`${formatMoney(data.summary.exportNet)} €`}
              />
            </SummaryCard>
            <SummaryCard title={t('tax.input_tax_total')}>
              <Line
                label={t('tax.purchases')}
                value={`${formatMoney(data.summary.inputTaxPurchase)} €`}
              />
              <Line
                label={t('tax.expenses')}
                value={`${formatMoney(data.summary.inputTaxExpense)} €`}
              />
              <Line
                label={t('tax.total')}
                value={`${formatMoney(data.summary.inputTax)} €`}
                strong
              />
            </SummaryCard>
            <SummaryCard title={t('tax.vat_payable')}>
              <div
                className={`text-2xl font-bold ${
                  data.summary.vatPayable >= 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {formatMoney(Math.abs(data.summary.vatPayable))} €
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {data.summary.vatPayable >= 0
                  ? t('tax.to_pay')
                  : t('tax.refundable')}
              </div>
              {data.summary.additionalTax > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  {t('tax.additional_tax', {
                    amount: formatMoney(data.summary.additionalTax),
                  })}
                </div>
              )}
            </SummaryCard>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {summaryTitle}
              </h3>
            </div>

            {data.periods.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                {t('tax.no_data')}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left">
                          {t('tax.period')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.domestic_net')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.output_tax')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.export_net')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.input_tax')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.additional_output_tax')}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {t('tax.zahllast')}
                        </th>
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
                              p.vatPayable >= 0
                                ? 'text-red-600'
                                : 'text-green-600'
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
                            p.vatPayable >= 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatMoney(p.vatPayable)} €
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('tax.domestic_net')} {formatMoney(p.domesticNet)} €
                        · {t('tax.output_tax')}{' '}
                        {formatMoney(p.domesticTax)} €
                      </div>
                      <div className="text-xs text-slate-500">
                        {t('tax.export_net')} {formatMoney(p.exportNet)} € ·{' '}
                        {t('tax.input_tax')} {formatMoney(p.inputTax)} €
                        {p.additionalTax > 0 &&
                          ` · ${t('tax.additional_output_tax')} ${formatMoney(
                            p.additionalTax
                          )} €`}
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