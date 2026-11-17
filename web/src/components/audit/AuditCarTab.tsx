import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { auditApi, type AuditCarSummary } from '../../api/audit';
import { formatMoney } from '../../lib/utils';

const inputClass =
  'w-full h-10 rounded-md border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

export default function AuditCarTab() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-cars', query],
    queryFn: () => auditApi.cars({ keyword: query || undefined }),
  });

  if (selectedId !== null) {
    return <CarDetail id={selectedId} onClose={() => setSelectedId(null)} />;
  }

  const items = data?.items ?? [];

  function search() {
    setQuery(keyword);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            {t('audit.car_search_plate')}
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('audit.fuzzy_match')}
            className={inputClass}
          />
        </label>
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
            onClick={() => {
              setKeyword('');
              setQuery('');
            }}
            className="h-10 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {isLoading ? t('common.loading') : t('audit.car_count', { count: items.length })}
      </p>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('audit.car_empty')}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">{t('audit.car_license_plate')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.car_gross_list_price')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.car_rule')}</th>
                  <th className="px-3 py-2 text-left">{t('audit.car_acquisition_date')}</th>
                  <th className="px-3 py-2 text-center">{t('audit.car_status')}</th>
                  <th className="px-3 py-2 text-right">{t('audit.car_expense_count')}</th>
                  <th className="px-3 py-2 text-center w-24">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{c.license_plate}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.gross_list_price)} €</td>
                    <td className="px-3 py-2">{c.tax_rule_percent === 0.25 ? t('audit.car_rule_025') : t('audit.car_rule_1')}</td>
                    <td className="px-3 py-2">{c.acquisition_date}</td>
                    <td className="px-3 py-2 text-center">
                      {c.active === 1 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">{t('audit.car_status_active')}</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t('audit.car_status_inactive')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{c.expense_count}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className="h-8 px-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        {t('audit.car_action_view_detail')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {items.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{c.license_plate}</span>
                  {c.tax_rule_percent === 0.25 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      {t('car.electric_badge')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('audit.car_card_summary', {
                    price: formatMoney(c.gross_list_price),
                    count: c.expense_count,
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="mt-2 h-9 px-3 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  {t('audit.car_action_view_detail')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CarDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-car-detail', id],
    queryFn: () => auditApi.carDetail(id),
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

  const { car, expenses } = data;
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold truncate">
          {t('audit.car_detail_title', { plate: car.license_plate })}
        </h2>
        <button onClick={onClose} className="h-11 px-3 text-sm text-slate-600 hover:underline shrink-0">
          {t('common.back_to_list')}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              {t('audit.car_info_section')}
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label={t('audit.car_license_plate')} value={car.license_plate} />
              <Row label={t('car.gross_list_price')} value={`${formatMoney(car.gross_list_price)} €`} />
              <Row
                label={t('audit.car_rule')}
                value={car.tax_rule_percent === 0.25 ? t('car.rule_percent_025') : t('audit.car_rule_1')}
              />
              <Row label={t('audit.car_acquisition_date')} value={car.acquisition_date} />
              <Row
                label={t('audit.car_status')}
                value={car.active ? t('audit.car_status_active') : t('audit.car_status_inactive')}
              />
              {car.deactivated_at && <Row label={t('audit.car_deactivated_at')} value={car.deactivated_at} />}
              {car.reactivated_at && <Row label={t('audit.car_reactivated_at')} value={car.reactivated_at} />}
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('audit.car_records_section', { count: expenses.length })}
              </h3>
            </div>
            {expenses.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t('audit.car_no_records')}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('audit.car_month')}</th>
                      <th className="px-3 py-2 text-right">{t('audit.car_amount')}</th>
                      <th className="px-3 py-2 text-right">{t('audit.car_rule_column')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{e.month}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(e.amount)} €</td>
                        <td className="px-3 py-2 text-right">{e.tax_rule_percent === 0.25 ? t('audit.car_rule_025') : t('audit.car_rule_1')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-slate-200 text-right text-sm">
                  <span className="text-slate-600 mr-3">{t('audit.car_total')}</span>
                  <span className="font-semibold">{formatMoney(total)} €</span>
                </div>
              </>
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