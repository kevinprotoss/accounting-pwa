import { request } from './client';

export type ReceiptItem = {
  id?: number;
  product_name: string;
  quantity: number;
  net_unit_price: number;
  tax_rate: number;
  is_used?: number;
};

export type Receipt = {
  id: number;
  receipt_number: string;
  date: string;
  supplier: string | null;
  supplier_invoice: string | null;
  remarks: string | null;
  attachment_path: string | null;
  created_at?: string;
  updated_at?: string;
  items: ReceiptItem[];
};

export type ReceiptSummary = {
  id: number;
  receipt_number: string;
  date: string;
  supplier: string | null;
  supplier_invoice: string | null;
  item_count: number;
  net_total: number;
  gross_total: number;
  is_used: number;
  remarks: string | null;
  needs_review: number;
};

export type ReceiptInput = {
  receipt_number: string;
  date: string;
  supplier?: string | null;
  supplier_invoice?: string | null;
  remarks?: string | null;
  attachment_path?: string | null;
  items: ReceiptItem[];
};

export const receiptsApi = {
  list: () => request<ReceiptSummary[]>('/api/receipts'),
  get: (id: number) => request<Receipt>(`/api/receipts/${id}`),
  create: (input: ReceiptInput) =>
    request<Receipt>('/api/receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: number, input: ReceiptInput) =>
    request<Receipt>(`/api/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: number) =>
    request<void>(`/api/receipts/${id}`, { method: 'DELETE' }),
};