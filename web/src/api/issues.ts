import { request } from './client';

export type Invoice = {
  id: number;
  invoice_number: string;
  issue_id: number;
  pdf_path: string | null;
  net_total: number | null;
  tax_total: number | null;
  gross_total: number | null;
  created_at: string;
};

export type IssueItem = {
  id?: number;
  receipt_item_id: number;
  quantity: number;
  selling_net_price: number;
  tax_rate: number;
  product_name?: string;
  purchase_price?: number;
};

export type Issue = {
  id: number;
  issue_number: string;
  date: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_vat_id: string | null;
  invoice_number: string | null;
  is_export: number;
  carrier: string | null;
  tracking_number: string | null;
  shipping_date: string | null;
  export_customs_number: string | null;
  export_customs_date: string | null;
  export_location: string | null;
  export_attachment_path: string | null;
  payment_attachment_paths: string | null;
  bank_reference: string | null;
  payment_received_date: string | null;
  status: string;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
  items: IssueItem[];
  invoice: Invoice | null;
};

export type IssueSummary = {
  id: number;
  issue_number: string;
  date: string;
  customer_name: string | null;
  invoice_number: string | null;
  is_export: number;
  status: string;
  item_count: number;
  net_total: number;
  gross_total: number;
  invoice_pdf_path: string | null;
  remarks: string | null;
};

export type IssueInput = {
  issue_number: string;
  date: string;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_vat_id?: string | null;
  invoice_number: string;
  is_export?: boolean;
  carrier?: string | null;
  tracking_number?: string | null;
  shipping_date?: string | null;
  export_customs_number?: string | null;
  export_customs_date?: string | null;
  export_location?: string | null;
  export_attachment_path?: string | null;
  payment_attachment_paths?: string | null;
  bank_reference?: string | null;
  payment_received_date?: string | null;
  status?: string;
  remarks?: string | null;
  items: Array<{
    receipt_item_id: number;
    quantity: number;
    selling_net_price: number;
    tax_rate: number;
  }>;
};

export const issuesApi = {
  nextInvoiceNumber: () =>
    request<{ invoice_number: string }>('/api/issues/next-invoice-number'),
  list: () => request<IssueSummary[]>('/api/issues'),
  get: (id: number) => request<Issue>(`/api/issues/${id}`),
  create: (input: IssueInput) =>
    request<Issue>('/api/issues', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: IssueInput) =>
    request<Issue>(`/api/issues/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: number) =>
    request<void>(`/api/issues/${id}`, { method: 'DELETE' }),
  getInvoiceStatus: (id: number) =>
    request<{ invoice: Invoice | null }>(`/api/issues/${id}/invoice`),
  regenerateInvoice: (id: number) =>
    request<{ status: 'ready' | 'generating' | 'started' }>(
      `/api/issues/${id}/regenerate-invoice`,
      { method: 'POST' }
    ),
  invoicePdfUrl: (id: number) => `/api/issues/${id}/invoice.pdf`,
};

export async function waitForInvoicePdf(
  issueId: number,
  onReady: () => void,
  onFailed: () => void
): Promise<void> {
  const delays = [1000, 2000, 3000];
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await issuesApi.getInvoiceStatus(issueId);
      if (res.invoice?.pdf_path) {
        onReady();
        return;
      }
    } catch {
      /* 忽略单次失败，继续下一次 */
    }
  }
  onFailed();
}