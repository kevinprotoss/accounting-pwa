import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { receiptsApi, type ReceiptInput, type ReceiptItem } from '../api/receipts';
import { formatMoney } from '../lib/utils';
import AttachmentUploader from './AttachmentUploader';
import ScanReviewBanner from './ScanReviewBanner';
import { scansApi } from '../api/scans';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';
const cellInput =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';
const mobileLabelClass =
  'block md:hidden text-[10px] font-medium text-slate-500 mb-0.5';

type FormItem = {
  key: string;
  id: number | null;
  is_used: boolean;
  product_name: string;
  quantity: string;
  net_price: string;
  gross_price: string;
  tax_rate: string;
};

function newItem(): FormItem {
  return {
    key: Math.random().toString(36).slice(2),
    id: null,
    is_used: false,
    product_name: '',
    quantity: '1',
    net_price: '0',
    gross_price: '0',
    tax_rate: '19',
  };
}

function generateReceiptNumber() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `RE-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

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
  receiptId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ReceiptForm({ receiptId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = receiptId !== null;
  const {
    data: existing,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () => receiptsApi.get(receiptId!),
    enabled: isEdit,
  });

  const [receiptNumber, setReceiptNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [items, setItems] = useState<FormItem[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setReceiptNumber(generateReceiptNumber());
      return;
    }
    if (existing) {
      setReceiptNumber(existing.receipt_number);
      setDate(existing.date);
      setSupplier(existing.supplier ?? '');
      setSupplierInvoice(existing.supplier_invoice ?? '');
      setRemarks(existing.remarks ?? '');
      setAttachments(parseAttachments(existing.attachment_path));
      setItems(
        existing.items.map((it) => {
          const net = it.net_unit_price;
          const gross = (net * (1 + it.tax_rate / 100)).toFixed(2);
          return {
            key: Math.random().toString(36).slice(2),
            id: it.id ?? null,
            is_used: it.is_used === 1,
            product_name: it.product_name,
            quantity: String(it.quantity),
            net_price: String(net),
            gross_price: gross,
            tax_rate: String(it.tax_rate),
          };
        })
      );
    }
  }, [isEdit, existing]);

  const hasUsedItems = items.some((it) => it.is_used);

  const saveMutation = useMutation({
    mutationFn: (input: ReceiptInput) =>
      isEdit ? receiptsApi.update(receiptId!, input) : receiptsApi.create(input),
    onSuccess: async () => {
      if (isEdit && receiptId) {
        try {
          await scansApi.review('goods_receipts', receiptId);
        } catch {
          // 清理失败不影响主流程
        }
      }
      onSaved();
    },
    onError: (err) => setError(String(err)),
  });

  function updateItem(key: string, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function handleNetChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item || item.is_used) return;
    const net = parseFloat(value) || 0;
    const rate = parseFloat(item.tax_rate) || 0;
    const gross = (net * (1 + rate / 100)).toFixed(2);
    updateItem(key, { net_price: value, gross_price: gross });
  }

  function handleGrossChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item || item.is_used) return;
    const gross = parseFloat(value) || 0;
    const rate = parseFloat(item.tax_rate) || 0;
    const net = (gross / (1 + rate / 100)).toFixed(2);
    updateItem(key, { gross_price: value, net_price: net });
  }

  function handleRateChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item || item.is_used) return;
    const rate = parseFloat(value) || 0;
    const net = parseFloat(item.net_price) || 0;
    const gross = (net * (1 + rate / 100)).toFixed(2);
    updateItem(key, { tax_rate: value, gross_price: gross });
  }

  function removeItem(key: string) {
    const item = items.find((i) => i.key === key);
    if (!item || item.is_used) return;
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  const netSubtotal = items.reduce((s, it) => {
    return s + (Number(it.net_price) || 0) * (Number(it.quantity) || 0);
  }, 0);
  const taxSubtotal = items.reduce((s, it) => {
    const net = Number(it.net_price) || 0;
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.tax_rate) || 0;
    return s + (net * qty * rate) / 100;
  }, 0);
  const grossSubtotal = netSubtotal + taxSubtotal;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanItems: ReceiptItem[] = items
      .map((it) => ({
        id: it.id ?? undefined,
        product_name: it.product_name.trim(),
        quantity: Number(it.quantity) || 0,
        net_unit_price: Number(it.net_price) || 0,
        tax_rate: Number(it.tax_rate) || 0,
      }))
      .filter((it) => it.product_name && it.quantity > 0);

    if (!receiptNumber.trim()) {
      setError(t('receipt.number_required'));
      return;
    }
    if (cleanItems.length === 0) {
      setError(t('receipt.items_required'));
      return;
    }

    saveMutation.mutate({
      receipt_number: receiptNumber.trim(),
      date,
      supplier: supplier || null,
      supplier_invoice: supplierInvoice || null,
      remarks: remarks || null,
      attachment_path: attachments.length > 0 ? JSON.stringify(attachments) : null,
      items: cleanItems,
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
          {isEdit ? t('receipt.edit') : t('receipt.new')}
        </h2>
      </header>

      <form id="receipt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {isEdit && (
            <ScanReviewBanner recordType="goods_receipts" recordId={receiptId} />
          )}
          {hasUsedItems && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠ {t('receipt.referenced_warning')}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('receipt.number')} *
              </span>
              <input
                className={inputClass}
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('receipt.date')} *
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
                {t('receipt.supplier')}
              </span>
              <input
                className={inputClass}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('receipt.supplier_invoice')}
              </span>
              <input
                className={inputClass}
                value={supplierInvoice}
                onChange={(e) => setSupplierInvoice(e.target.value)}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('receipt.remarks')}
              </span>
              <textarea
                className={inputClass}
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <AttachmentUploader
                paths={attachments}
                onChange={setAttachments}
                label={t('receipt.attachment')}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('receipt.items_title')}
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="h-10 px-3 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                + {t('receipt.add_row')}
              </button>
            </div>

            <div className="hidden md:grid grid-cols-[3fr_0.8fr_1fr_1fr_0.7fr_1.2fr_48px] gap-2 px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
              <span>{t('receipt.product_name')}</span>
              <span>{t('receipt.quantity')}</span>
              <span>{t('receipt.net_unit_price')}</span>
              <span>{t('receipt.gross_unit_price')}</span>
              <span>{t('receipt.tax_rate')}</span>
              <span className="text-right">{t('receipt.subtotal')}</span>
              <span></span>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const netLine =
                  (Number(it.net_price) || 0) * (Number(it.quantity) || 0);
                const grossLine =
                  (Number(it.gross_price) || 0) * (Number(it.quantity) || 0);
                const locked = it.is_used;
                return (
                  <div
                    key={it.key}
                    className={
                      'px-4 py-3 space-y-2 md:grid md:grid-cols-[3fr_0.8fr_1fr_1fr_0.7fr_1.2fr_48px] md:gap-2 md:space-y-0 md:items-center md:py-2 ' +
                      (locked ? 'bg-slate-50' : '')
                    }
                  >
                    <label className="block">
                      <span className={mobileLabelClass}>
                        {t('receipt.product_name')}
                        {locked && ' 🔒'}
                      </span>
                      <input
                        className={cellInput + (locked ? ' bg-slate-100 text-slate-600' : '')}
                        value={it.product_name}
                        disabled={locked}
                        onChange={(e) =>
                          updateItem(it.key, { product_name: e.target.value })
                        }
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2 md:contents">
                      <label className="block">
                        <span className={mobileLabelClass}>
                          {t('receipt.quantity')}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cellInput + (locked ? ' bg-slate-100 text-slate-600' : '')}
                          value={it.quantity}
                          disabled={locked}
                          onChange={(e) =>
                            updateItem(it.key, { quantity: e.target.value })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className={mobileLabelClass}>
                          {t('receipt.net_unit_price')}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cellInput + (locked ? ' bg-slate-100 text-slate-600' : '')}
                          value={it.net_price}
                          disabled={locked}
                          onChange={(e) => handleNetChange(it.key, e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:contents">
                      <label className="block">
                        <span className={mobileLabelClass}>
                          {t('receipt.gross_unit_price')}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cellInput + (locked ? ' bg-slate-100 text-slate-600' : '')}
                          value={it.gross_price}
                          disabled={locked}
                          onChange={(e) => handleGrossChange(it.key, e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className={mobileLabelClass}>
                          {t('receipt.tax_rate')}
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className={cellInput + (locked ? ' bg-slate-100 text-slate-600' : '')}
                          value={it.tax_rate}
                          disabled={locked}
                          onChange={(e) => handleRateChange(it.key, e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-2 md:contents">
                      <div className="text-sm md:text-right md:font-medium md:self-center">
                        <span className="text-slate-500 md:hidden">
                          {t('receipt.subtotal')}{' '}
                        </span>
                        <span className="font-medium">
                          {formatMoney(netLine)} / {formatMoney(grossLine)} €
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        disabled={locked}
                        className={
                          'shrink-0 w-11 h-11 flex items-center justify-center rounded-md md:self-center ' +
                          (locked
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-red-600 hover:bg-red-50 active:bg-red-100')
                        }
                        aria-label={t('common.remove')}
                        title={locked ? t('receipt.used_tooltip') : t('common.remove')}
                      >
                        {locked ? '🔒' : '✕'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 text-sm space-y-1">
              <div className="flex justify-end gap-4">
                <span className="text-slate-600 w-24 text-right">
                  {t('receipt.total_net')}
                </span>
                <span className="w-28 text-right">{formatMoney(netSubtotal)} €</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-slate-600 w-24 text-right">
                  {t('receipt.total_tax')}
                </span>
                <span className="w-28 text-right">{formatMoney(taxSubtotal)} €</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-slate-700 w-24 text-right font-semibold">
                  {t('receipt.total_gross')}
                </span>
                <span className="w-28 text-right font-semibold">
                  {formatMoney(grossSubtotal)} €
                </span>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">
        <div className="max-w-4xl mx-auto flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="receipt-form"
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