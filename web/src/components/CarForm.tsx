import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { carsApi, type CarInput } from '../api/cars';
import { formatMoney } from '../lib/utils';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

export default function CarForm({ onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [licensePlate, setLicensePlate] = useState('');
  const [grossListPrice, setGrossListPrice] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [taxRule, setTaxRule] = useState<'1' | '0.25'>('1');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (input: CarInput) => carsApi.create(input),
    onSuccess: onSaved,
    onError: (err) => setError(String(err)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!licensePlate.trim()) {
      setError(t('car.license_plate_required'));
      return;
    }
    if (!acquisitionDate) {
      setError(t('car.acquisition_date_required'));
      return;
    }
    saveMutation.mutate({
      license_plate: licensePlate.trim(),
      gross_list_price: Number(grossListPrice) || 0,
      acquisition_date: acquisitionDate,
      tax_rule_percent: Number(taxRule),
    });
  }

  const monthlyTax = ((Number(grossListPrice) || 0) * Number(taxRule)) / 100;

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">{t('car.new')}</h2>
      </header>

      <form id="car-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('car.license_plate')} *
              </span>
              <input
                className={inputClass}
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('car.gross_list_price')} *
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={grossListPrice}
                onChange={(e) => setGrossListPrice(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('car.acquisition_date')} *
              </span>
              <input
                type="date"
                className={inputClass}
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('car.rule_section')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={
                  'flex items-start gap-3 p-3 rounded-md border cursor-pointer select-none ' +
                  (taxRule === '1'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-300 hover:bg-slate-50')
                }
              >
                <input
                  type="radio"
                  name="tax-rule"
                  value="1"
                  checked={taxRule === '1'}
                  onChange={() => setTaxRule('1')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {t('car.rule_1')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('car.rule_1_hint')}
                  </div>
                </div>
              </label>
              <label
                className={
                  'flex items-start gap-3 p-3 rounded-md border cursor-pointer select-none ' +
                  (taxRule === '0.25'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-300 hover:bg-slate-50')
                }
              >
                <input
                  type="radio"
                  name="tax-rule"
                  value="0.25"
                  checked={taxRule === '0.25'}
                  onChange={() => setTaxRule('0.25')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {t('car.rule_025')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('car.rule_025_hint')}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              {t('car.monthly_tax_label')}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoney(monthlyTax)} €
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('car.monthly_tax_hint')}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">
        <div className="max-w-3xl mx-auto flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="car-form"
            disabled={saveMutation.isPending}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </footer>
    </div>
  );
}