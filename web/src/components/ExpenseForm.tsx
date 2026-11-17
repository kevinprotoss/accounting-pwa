import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expensesApi, type ExpenseInput } from '../api/expenses';
import { formatMoney } from '../lib/utils';
import AttachmentUploader from './AttachmentUploader';
import ScanReviewBanner from './ScanReviewBanner';
import { scansApi } from '../api/scans';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

const categorySuggestions = [
  '房租',
  '水电',
  '办公用品',
  '办公设备',
  '电话',
  '网络',
  '交通',
  '广告',
  '软件订阅',
  '保险',
  '其他',
];

const TAX_PRESETS = ['19', '7', '0'];

function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

type Props = {
  expenseId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ExpenseForm({ expenseId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = expenseId !== null;

  const { data: existing, isLoading, error: loadError } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => expensesApi.get(expenseId!),
    enabled: isEdit,
  });

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isOutputTax, setIsOutputTax] = useState(false);
  const [netAmount, setNetAmount] = useState('0');
  const [grossAmount, setGrossAmount] = useState('0');
  const [taxRate, setTaxRate] = useState('19');
  const [outputTaxAmount, setOutputTaxAmount] = useState('0');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !existing) return;
    setDate(existing.date);
    setCategory(existing.category ?? '');
    setDescription(existing.description ?? '');
    setIsOutputTax(existing.is_output_tax === 1);
    const net = Number(existing.net_amount) || 0;
    const rate = Number(existing.tax_rate) || 0;
    setNetAmount(String(net));
    setTaxRate(String(rate));
    setGrossAmount((net * (1 + rate / 100)).toFixed(2));
    setOutputTaxAmount(String(existing.input_tax ?? 0));
    setSupplierInvoice(existing.supplier_invoice ?? '');
    setRemarks(existing.remarks ?? '');
    setAttachments(parseAttachments(existing.attachment_path));
  }, [isEdit, existing]);

  const net = Number(netAmount) || 0;
  const rate = Number(taxRate) || 0;
  const inputTax = (net * rate) / 100;

  function handleNetChange(value: string) {
    setNetAmount(value);
    const n = parseFloat(value) || 0;
    const r = parseFloat(taxRate) || 0;
    setGrossAmount((n * (1 + r / 100)).toFixed(2));
  }

  function handleGrossChange(value: string) {
    setGrossAmount(value);
    const g = parseFloat(value) || 0;
    const r = parseFloat(taxRate) || 0;
    setNetAmount((g / (1 + r / 100)).toFixed(2));
  }

  function handleRateChange(value: string) {
    setTaxRate(value);
    const n = parseFloat(netAmount) || 0;
    const r = parseFloat(value) || 0;
    setGrossAmount((n * (1 + r / 100)).toFixed(2));
  }

  function handleOutputToggle(checked: boolean) {
    setIsOutputTax(checked);
    if (!checked) {
      setNetAmount('0');
      setGrossAmount('0');
      setTaxRate('19');
      setOutputTaxAmount('0');
    }
  }

  const saveMutation = useMutation({
    mutationFn: (input: ExpenseInput) =>
      isEdit ? expensesApi.update(expenseId!, input) : expensesApi.create(input),
    onSuccess: async () => {
      if (isEdit && expenseId) {
        try {
          await scansApi.review('other_expenses', expenseId);
        } catch {}
      }
      onSaved();
    },
    onError: (err) => setError(String(err)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate({
      date,
      category: category || null,
      description: description || null,
      net_amount: isOutputTax ? 0 : net,
      tax_rate: isOutputTax ? 0 : rate,
      input_tax: isOutputTax ? Number(outputTaxAmount) || 0 : inputTax,
      is_output_tax: isOutputTax,
      attachment_path: attachments.length > 0 ? JSON.stringify(attachments) : null,
      supplier_invoice: supplierInvoice || null,
      remarks: remarks || null,
    });
  }

  if (isEdit && isLoading) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex items-center justify-center md:left-56">
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-3 md:left-56">
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(loadError) })}
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

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">
          {isEdit ? t('expense.edit') : t('expense.new')}
        </h2>
      </header>

      <form id="expense-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          {isEdit && (
            <ScanReviewBanner recordType="other_expenses" recordId={expenseId} />
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('expense.date')} *
              </span>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('expense.category')}
              </span>
              <input
                className={inputClass}
                list="expense-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="expense-categories">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('expense.description')}
              </span>
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('expense.supplier_invoice')}
              </span>
              <input
                className={inputClass}
                value={supplierInvoice}
                onChange={(e) => setSupplierInvoice(e.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <AttachmentUploader
                paths={attachments}
                onChange={setAttachments}
                label={t('expense.attachment')}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-slate-300"
                checked={isOutputTax}
                onChange={(e) => handleOutputToggle(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">
                {t('expense.is_output_tax')}
              </span>
            </label>

            {!isOutputTax && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {t('expense.net_amount')}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      value={netAmount}
                      onChange={(e) => handleNetChange(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {t('expense.gross_amount')}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      value={grossAmount}
                      onChange={(e) => handleGrossChange(e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    {t('expense.tax_rate')}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className={`${inputClass} w-24`}
                      value={taxRate}
                      onChange={(e) => handleRateChange(e.target.value)}
                    />
                    <div className="flex gap-1">
                      {TAX_PRESETS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => handleRateChange(v)}
                          className={
                            'h-9 px-3 text-xs rounded-md ' +
                            (taxRate === v
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                          }
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <p className="text-sm text-slate-600">
                    {t('expense.input_tax')}：
                    <strong className="ml-1 text-slate-900">
                      {formatMoney(inputTax)} €
                    </strong>
                  </p>
                </div>
              </>
            )}

            {isOutputTax && (
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  {t('expense.output_tax_amount')}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={outputTaxAmount}
                  onChange={(e) => setOutputTaxAmount(e.target.value)}
                />
                <span className="block text-xs text-slate-500 mt-1">
                  {t('expense.output_tax_hint')}
                </span>
              </label>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('expense.remarks')}
              </span>
              <textarea
                className={inputClass}
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
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
            form="expense-form"
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