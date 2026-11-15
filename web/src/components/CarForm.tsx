import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { carsApi, type CarInput } from '../api/cars';
import { formatMoney } from '../lib/utils';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

export default function CarForm({ onClose, onSaved }: Props) {
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
      setError('请填写车牌号');
      return;
    }
    if (!acquisitionDate) {
      setError('请填写购车日期');
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
        <h2 className="text-base font-semibold">添加车辆</h2>
      </header>

      <form id="car-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                车牌号 *
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
                总价（Brutto）*
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
                购车日期 *
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
            <h3 className="text-sm font-semibold text-slate-700">1% 规则</h3>
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
                  <div className="text-sm font-medium text-slate-800">1% 规则</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    燃油车、普通混动车
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
                    0.25% 规则（电车）
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    纯电车，适用 §6 Abs. 1 Nr. 4 S. 2 EStG
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              月度应税额（完整月）
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoney(monthlyTax)} €
            </div>
            <p className="text-xs text-slate-500 mt-2">
              仅当车辆在自然月内完整使用（月初已购、月末未停）时生成记录。
              购车当月若非 1 号、停用月、启用后首月均不生成。
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
            取消
          </button>
          <button
            type="submit"
            form="car-form"
            disabled={saveMutation.isPending}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saveMutation.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </footer>
    </div>
  );
}