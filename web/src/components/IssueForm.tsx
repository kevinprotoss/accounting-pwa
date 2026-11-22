import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { issuesApi, type IssueInput } from '../api/issues';
import { customersApi } from '../api/customers';
import { stockApi, type StockItem } from '../api/stock';
import { formatMoney } from '../lib/utils';
import AttachmentUploader from './AttachmentUploader';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';
const cellInput =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';
const labelClass =
  'block text-[10px] md:text-xs font-medium text-slate-500 mb-0.5';

function parseAttachments(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

type FormItem = {
  key: string;
  receipt_item_id: string;
  quantity: string;
  selling_net_price: string;
  selling_gross_price: string;
  tax_rate: string;
};

function newItem(taxRate = '19'): FormItem {
  return {
    key: Math.random().toString(36).slice(2),
    receipt_item_id: '',
    quantity: '1',
    selling_net_price: '0',
    selling_gross_price: '0',
    tax_rate: taxRate,
  };
}

function generateIssueNumber() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `SI-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

const TAX_PRESETS = ['19', '7', '0'];

type BatchSelectorProps = {
  value: string;
  stock: StockItem[];
  onChange: (id: string) => void;
};

function BatchSelector({ value, stock, onChange }: BatchSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = stock.find((s) => String(s.receipt_item_id) === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter(
      (s) =>
        s.product_name.toLowerCase().includes(q) ||
        (s.supplier ?? '').toLowerCase().includes(q) ||
        (s.supplier_invoice ?? '').toLowerCase().includes(q)
    );
  }, [stock, search]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{selected.product_name}</div>
          <div className="text-xs text-slate-500 truncate">
            {t('issue.batch_remaining', { qty: selected.remaining_qty })} ·{' '}
            {t('issue.batch_receipt_date', { date: selected.receipt_date })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 h-9 px-2 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          {t('issue.change_batch')}
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className={cellInput}
        placeholder={t('issue.search_batch')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">
              {t('issue.no_batches')}
            </div>
          )}
          {filtered.map((s) => (
            <button
              key={s.receipt_item_id}
              type="button"
              onClick={() => {
                onChange(String(s.receipt_item_id));
                setOpen(false);
                setSearch('');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-100 last:border-b-0"
            >
              <div className="font-medium truncate">{s.product_name}</div>
              <div className="text-xs text-slate-500 truncate">
                {t('issue.batch_remaining', { qty: s.remaining_qty })} ·{' '}
                {t('issue.batch_receipt_date', { date: s.receipt_date })} ·{' '}
                {s.supplier ?? '—'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  issueId: number | null;
  onClose: () => void;
  onSaved: (id: number) => void;
};

export default function IssueForm({ issueId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = issueId !== null;
  const queryClient = useQueryClient();

  const {
    data: existing,
    isLoading: loadingIssue,
    error: loadIssueError,
  } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => issuesApi.get(issueId!),
    enabled: isEdit,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.list,
  });

  const { data: stock = [], isLoading: loadingStock } = useQuery({
    queryKey: ['stock', 'forIssue', issueId],
    queryFn: () => stockApi.list(issueId ?? undefined),
  });

  const { data: nextInvoice } = useQuery({
    queryKey: ['next-invoice-number'],
    queryFn: issuesApi.nextInvoiceNumber,
    enabled: !isEdit,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const statusOptions = [
    { value: 'open', label: t('issue.status_open') },
    { value: 'paid', label: t('issue.status_paid') },
  ];

  const stockMap = useMemo(() => {
    const map = new Map<number, StockItem>();
    for (const s of stock) map.set(s.receipt_item_id, s);
    return map;
  }, [stock]);

  const [issueNumber, setIssueNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerVatId, setCustomerVatId] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [isExport, setIsExport] = useState(false);
  const [exportCustomsNumber, setExportCustomsNumber] = useState('');
  const [exportCustomsDate, setExportCustomsDate] = useState('');
  const [exportLocation, setExportLocation] = useState('');
  const [exportAttachments, setExportAttachments] = useState<string[]>([]);
  const [paymentAttachments, setPaymentAttachments] = useState<string[]>([]);
  const [status, setStatus] = useState('open');
  const [bankReference, setBankReference] = useState('');
  const [paymentReceivedDate, setPaymentReceivedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<FormItem[]>([newItem()]);
  const [taxRateSnapshot, setTaxRateSnapshot] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setIssueNumber(generateIssueNumber());
      return;
    }
    if (existing) {
      setIssueNumber(existing.issue_number);
      setDate(existing.date);
      setInvoiceNumber(existing.invoice_number ?? '');
      setCustomerId(existing.customer_id ? String(existing.customer_id) : '');
      setCustomerName(existing.customer_name ?? '');
      setCustomerAddress(existing.customer_address ?? '');
      setCustomerVatId(existing.customer_vat_id ?? '');
      setCarrier(existing.carrier ?? '');
      setTrackingNumber(existing.tracking_number ?? '');
      setShippingDate(existing.shipping_date ?? '');
      setIsExport(existing.is_export === 1);
      setExportCustomsNumber(existing.export_customs_number ?? '');
      setExportCustomsDate(existing.export_customs_date ?? '');
      setExportLocation(existing.export_location ?? '');
      setExportAttachments(parseAttachments(existing.export_attachment_path));
      setPaymentAttachments(parseAttachments(existing.payment_attachment_paths));
      setStatus(existing.status ?? 'open');
      setBankReference(existing.bank_reference ?? '');
      setPaymentReceivedDate(existing.payment_received_date ?? '');
      setRemarks(existing.remarks ?? '');
      setItems(
        existing.items.map((it) => {
          const net = it.selling_net_price;
          const gross = (net * (1 + it.tax_rate / 100)).toFixed(2);
          return {
            key: Math.random().toString(36).slice(2),
            receipt_item_id: String(it.receipt_item_id),
            quantity: String(it.quantity),
            selling_net_price: String(net),
            selling_gross_price: gross,
            tax_rate: String(it.tax_rate),
          };
        })
      );
    }
  }, [isEdit, existing]);

  useEffect(() => {
    if (!isEdit && nextInvoice) {
      setInvoiceNumber(nextInvoice.invoice_number);
    }
  }, [isEdit, nextInvoice]);

  const saveMutation = useMutation({
    mutationFn: (input: IssueInput) =>
      isEdit ? issuesApi.update(issueId!, input) : issuesApi.create(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['next-invoice-number'] });
      onSaved(data.id);
    },
    onError: (err) => setError(String(err)),
  });

  function handleCustomerChange(value: string) {
    setCustomerId(value);
    if (!value) return;
    const c = customers.find((x) => String(x.id) === value);
    if (c) {
      setCustomerName(c.name);
      const addr = [c.street, [c.postcode, c.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join('\n');
      setCustomerAddress(addr);
      setCustomerVatId(c.ust_idnr ?? '');
    }
  }

  function updateItem(key: string, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function handleSelectBatch(key: string, value: string) {
    const id = Number(value);
    const s = stockMap.get(id);
    if (s) {
      const net = s.purchase_price;
      // 出口单税率强制为 0
      const effectiveRate = isExport ? 0 : s.tax_rate;
      const gross = (net * (1 + effectiveRate / 100)).toFixed(2);
      updateItem(key, {
        receipt_item_id: value,
        tax_rate: isExport ? '0' : String(s.tax_rate),
        selling_net_price: String(net),
        selling_gross_price: gross,
      });
    } else {
      updateItem(key, { receipt_item_id: value });
    }
  }

  function handleNetChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    const net = parseFloat(value) || 0;
    const rate = parseFloat(item.tax_rate) || 0;
    const gross = (net * (1 + rate / 100)).toFixed(2);
    updateItem(key, { selling_net_price: value, selling_gross_price: gross });
  }

  function handleGrossChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    const gross = parseFloat(value) || 0;
    const rate = parseFloat(item.tax_rate) || 0;
    const net = (gross / (1 + rate / 100)).toFixed(2);
    updateItem(key, { selling_gross_price: value, selling_net_price: net });
  }

  function handleRateChange(key: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item || isExport) return;
    const rate = parseFloat(value) || 0;
    const net = parseFloat(item.selling_net_price) || 0;
    const gross = (net * (1 + rate / 100)).toFixed(2);
    updateItem(key, { tax_rate: value, selling_gross_price: gross });
  }

  function handleExportChange(checked: boolean) {
    setIsExport(checked);
    if (checked) {
      // 记住当前每行税率，然后全部设为 0
      const snap: Record<string, string> = {};
      items.forEach((it) => {
        snap[it.key] = it.tax_rate;
      });
      setTaxRateSnapshot(snap);
      setItems((prev) =>
        prev.map((it) => {
          const net = parseFloat(it.selling_net_price) || 0;
          return {
            ...it,
            tax_rate: '0',
            selling_gross_price: net.toFixed(2),
          };
        })
      );
    } else {
      // 恢复之前的税率
      setItems((prev) =>
        prev.map((it) => {
          const restored = taxRateSnapshot?.[it.key] ?? '19';
          const net = parseFloat(it.selling_net_price) || 0;
          const rate = parseFloat(restored) || 0;
          return {
            ...it,
            tax_rate: restored,
            selling_gross_price: (net * (1 + rate / 100)).toFixed(2),
          };
        })
      );
      setTaxRateSnapshot(null);
    }
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  function addItem() {
    setItems((prev) => [...prev, newItem(isExport ? '0' : '19')]);
  }

  const netSubtotal = items.reduce((s, it) => {
    return s + (Number(it.selling_net_price) || 0) * (Number(it.quantity) || 0);
  }, 0);
  const taxSubtotal = items.reduce((s, it) => {
    const net = Number(it.selling_net_price) || 0;
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.tax_rate) || 0;
    return s + (net * qty * rate) / 100;
  }, 0);
  const grossSubtotal = netSubtotal + taxSubtotal;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanItems = items
      .map((it) => ({
        receipt_item_id: Number(it.receipt_item_id) || 0,
        quantity: Number(it.quantity) || 0,
        selling_net_price: Number(it.selling_net_price) || 0,
        tax_rate: isExport ? 0 : Number(it.tax_rate) || 0,
      }))
      .filter((it) => it.receipt_item_id && it.quantity > 0);

    if (!issueNumber.trim()) {
      setError(t('issue.number_required'));
      return;
    }
    if (!invoiceNumber.trim()) {
      setError(t('issue.invoice_not_ready'));
      return;
    }
    if (cleanItems.length === 0) {
      setError(t('issue.items_required'));
      return;
    }

    for (const it of cleanItems) {
      const s = stockMap.get(it.receipt_item_id);
      if (!s) {
        setError(t('issue.invalid_batch'));
        return;
      }
      if (it.quantity > s.remaining_qty + 1e-9) {
        setError(
          t('issue.insufficient_stock', {
            name: s.product_name,
            available: s.remaining_qty,
            requested: it.quantity,
          })
        );
        return;
      }
    }

    const paid = status === 'paid';

    saveMutation.mutate({
      issue_number: issueNumber.trim(),
      date,
      customer_id: customerId ? Number(customerId) : null,
      customer_name: customerName || null,
      customer_address: customerAddress || null,
      customer_vat_id: customerVatId || null,
      invoice_number: invoiceNumber.trim(),
      is_export: isExport,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      shipping_date: shippingDate || null,
      export_customs_number: isExport ? exportCustomsNumber || null : null,
      export_customs_date: isExport ? exportCustomsDate || null : null,
      export_location: isExport ? exportLocation || null : null,
      export_attachment_path:
        isExport && exportAttachments.length > 0
          ? JSON.stringify(exportAttachments)
          : null,
      payment_attachment_paths:
        paymentAttachments.length > 0
          ? JSON.stringify(paymentAttachments)
          : null,
      bank_reference: paid ? bankReference || null : null,
      payment_received_date: paid ? paymentReceivedDate || null : null,
      status,
      remarks: remarks || null,
      items: cleanItems,
    });
  }

  if (isEdit && loadingIssue) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex items-center justify-center md:left-56">
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (isEdit && loadIssueError) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-3 md:left-56">
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(loadIssueError) })}
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
          {isEdit ? t('issue.edit') : t('issue.new')}
        </h2>
      </header>

      <form id="issue-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
          {/* 基本信息 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.number')} *
              </span>
              <input
                className={inputClass}
                value={issueNumber}
                onChange={(e) => setIssueNumber(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.date')} *
              </span>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.invoice_number_auto')}
              </span>
              <input
                className={`${inputClass} bg-slate-100 text-slate-700`}
                value={invoiceNumber}
                readOnly
                tabIndex={-1}
              />
            </label>
          </div>

          {/* 客户 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('issue.customer_section')}
            </h3>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.select_customer')}
              </span>
              <select
                className={inputClass}
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">{t('issue.no_customer_option')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.customer_name')}
              </span>
              <input
                className={inputClass}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.customer_address')}
              </span>
              <textarea
                className={inputClass}
                rows={2}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.customer_vat_id')}
              </span>
              <input
                className={inputClass}
                value={customerVatId}
                onChange={(e) => setCustomerVatId(e.target.value)}
              />
            </label>
          </div>

          {/* 发货 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <h3 className="text-sm font-semibold text-slate-700 md:col-span-2">
              {t('issue.shipping_section')}
            </h3>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.carrier')}
              </span>
              <input
                className={inputClass}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.tracking_number')}
              </span>
              <input
                className={inputClass}
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.shipping_date')}
              </span>
              <input
                type="date"
                className={inputClass}
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
              />
            </label>
          </div>

          {/* 出口 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-slate-300"
                checked={isExport}
                onChange={(e) => handleExportChange(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">
                {t('issue.export_section')}
              </span>
              {isExport && (
                <span className="text-xs text-slate-500">
                  {t('issue.export_hint')}
                </span>
              )}
            </label>

            {isExport && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {t('issue.customs_number')}
                    </span>
                    <input
                      className={inputClass}
                      value={exportCustomsNumber}
                      onChange={(e) => setExportCustomsNumber(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {t('issue.customs_date')}
                    </span>
                    <input
                      type="date"
                      className={inputClass}
                      value={exportCustomsDate}
                      onChange={(e) => setExportCustomsDate(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1">
                      {t('issue.export_location')}
                    </span>
                    <input
                      className={inputClass}
                      value={exportLocation}
                      onChange={(e) => setExportLocation(e.target.value)}
                    />
                  </label>
                </div>
                <AttachmentUploader
                  paths={exportAttachments}
                  onChange={setExportAttachments}
                  label={t('issue.export_attachments')}
                />
              </>
            )}
          </div>

          {/* 明细 */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {t('issue.items_title')}
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="h-10 px-3 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                + {t('issue.add_row')}
              </button>
            </div>

            {loadingStock ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t('issue.loading_stock')}
              </div>
            ) : stock.length === 0 && items.every((it) => !it.receipt_item_id) ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                {t('issue.stock_empty')}
              </div>
            ) : null}

            <div className="divide-y divide-slate-100">
              {items.map((it) => {
                const netLine =
                  (Number(it.selling_net_price) || 0) * (Number(it.quantity) || 0);
                const grossLine =
                  (Number(it.selling_gross_price) || 0) * (Number(it.quantity) || 0);
                return (
                  <div key={it.key} className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={labelClass}>{t('issue.item_batch')}</span>
                        <BatchSelector
                          value={it.receipt_item_id}
                          stock={stock}
                          onChange={(v) => handleSelectBatch(it.key, v)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="shrink-0 w-11 h-11 mt-4 flex items-center justify-center rounded-md text-red-600 hover:bg-red-50 active:bg-red-100"
                        aria-label={t('common.remove')}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className={labelClass}>{t('issue.quantity')}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cellInput}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(it.key, { quantity: e.target.value })
                          }
                        />
                      </label>
                      <div>
                        <span className={labelClass}>
                          {isExport ? t('issue.tax_rate_export') : t('issue.tax_rate')}
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className={
                            cellInput +
                            (isExport ? ' bg-slate-100 text-slate-500 cursor-not-allowed' : '')
                          }
                          value={it.tax_rate}
                          disabled={isExport}
                          onChange={(e) => handleRateChange(it.key, e.target.value)}
                        />
                        {!isExport && (
                          <div className="flex gap-1 mt-1">
                            {TAX_PRESETS.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => handleRateChange(it.key, v)}
                                className={
                                  'h-6 px-2 text-[10px] rounded ' +
                                  (it.tax_rate === v
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                }
                              >
                                {v}%
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className={labelClass}>{t('issue.net_unit_price')}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={cellInput}
                          value={it.selling_net_price}
                          onChange={(e) => handleNetChange(it.key, e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className={labelClass}>{t('issue.gross_unit_price')}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={
                            cellInput +
                            (isExport ? ' bg-slate-100 text-slate-500 cursor-not-allowed' : '')
                          }
                          value={it.selling_gross_price}
                          disabled={isExport}
                          onChange={(e) => handleGrossChange(it.key, e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="text-right text-sm text-slate-600">
                      <span className="text-slate-500">{t('issue.subtotal')} </span>
                      <span className="font-medium">
                        {formatMoney(netLine)} / {formatMoney(grossLine)} €
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 text-sm space-y-1">
              <div className="flex justify-end gap-4">
                <span className="text-slate-600 w-24 text-right">
                  {t('issue.total_net')}
                </span>
                <span className="w-28 text-right">{formatMoney(netSubtotal)} €</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-slate-600 w-24 text-right">
                  {t('issue.total_tax')}
                </span>
                <span className="w-28 text-right">{formatMoney(taxSubtotal)} €</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-slate-700 w-24 text-right font-semibold">
                  {t('issue.total_gross')}
                </span>
                <span className="w-28 text-right font-semibold">
                  {formatMoney(grossSubtotal)} €
                </span>
              </div>
            </div>
          </div>

          {/* 状态与付款 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('issue.status_section')}
            </h3>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.status_label')}
              </span>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {status === 'paid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    {t('issue.payment_received_date')}
                  </span>
                  <input
                    type="date"
                    className={inputClass}
                    value={paymentReceivedDate}
                    onChange={(e) => setPaymentReceivedDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    {t('issue.bank_reference')}
                  </span>
                  <input
                    className={inputClass}
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                  />
                </label>
              </div>
            )}

            <AttachmentUploader
              paths={paymentAttachments}
              onChange={setPaymentAttachments}
              label={t('issue.payment_attachments')}
            />
          </div>

          {/* 备注 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t('issue.remarks')}
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
            form="issue-form"
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