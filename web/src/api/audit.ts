import { request } from './client';

export type AuditIssueSummary = {
  id: number;
  issue_number: string;
  date: string;
  customer_name: string | null;
  invoice_number: string | null;
  is_export: number;
  status: string;
  net_total: number;
};

export type AuditIssueChainItem = {
  id: number;
  quantity: number;
  selling_net_price: number;
  tax_rate: number;
  receipt_item_id: number;
  product_name: string;
  purchase_price: number;
  receipt_id: number;
  receipt_number: string;
  receipt_date: string;
  supplier: string | null;
  supplier_invoice: string | null;
};

export type AuditInvoice = {
  id: number;
  invoice_number: string;
  pdf_path: string | null;
  net_total: number | null;
  tax_total: number | null;
  gross_total: number | null;
  created_at: string;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  old_values: string | null;
  new_values: string | null;
  user: string;
  timestamp: string;
};

export type AuditIssueChain = {
  issue: Record<string, unknown> & {
    id: number;
    issue_number: string;
    date: string;
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
    bank_reference: string | null;
    payment_received_date: string | null;
    status: string;
    remarks: string | null;
  };
  items: AuditIssueChainItem[];
  invoice: AuditInvoice | null;
  history: AuditLogEntry[];
};

export type AuditReceiptSummary = {
  id: number;
  receipt_number: string;
  date: string;
  supplier: string | null;
  supplier_invoice: string | null;
  remarks: string | null;
  item_count: number;
  net_total: number;
  is_used: number;
};

export type AuditReceiptDetail = {
  receipt: {
    id: number;
    receipt_number: string;
    date: string;
    supplier: string | null;
    supplier_invoice: string | null;
    remarks: string | null;
    attachment_path: string | null;
  };
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    net_unit_price: number;
    tax_rate: number;
  }>;
  usedBy: Array<{
    issue_id: number;
    issue_number: string;
    date: string;
    customer_name: string | null;
  }>;
};

export type AuditExpense = {
  id: number;
  date: string;
  category: string | null;
  description: string | null;
  net_amount: number;
  tax_rate: number;
  input_tax: number;
  is_output_tax: number;
  supplier_invoice: string | null;
  remarks: string | null;
};

export type AuditCarSummary = {
  id: number;
  license_plate: string;
  gross_list_price: number;
  acquisition_date: string;
  active: number;
  tax_rule_percent: number;
  deactivated_at: string | null;
  reactivated_at: string | null;
  expense_count: number;
};

export type AuditCarDetail = {
  car: Omit<AuditCarSummary, 'expense_count'>;
  expenses: Array<{
    id: number;
    month: string;
    amount: number;
    tax_rule_percent: number;
  }>;
};

type Paged<T> = { items: T[]; total: number; limit: number; offset: number };

export const auditApi = {
  issues: (params: {
    from?: string;
    to?: string;
    invoice?: string;
    customer?: string;
    product?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return request<Paged<AuditIssueSummary>>(`/api/audit/issues?${qs.toString()}`);
  },
  issueChain: (id: number) =>
    request<AuditIssueChain>(`/api/audit/issues/${id}/chain`),
  receipts: (params: {
    from?: string;
    to?: string;
    supplier?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return request<Paged<AuditReceiptSummary>>(`/api/audit/receipts?${qs.toString()}`);
  },
  receiptDetail: (id: number) =>
    request<AuditReceiptDetail>(`/api/audit/receipts/${id}`),
  expenses: (params: {
    from?: string;
    to?: string;
    category?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return request<Paged<AuditExpense>>(`/api/audit/expenses?${qs.toString()}`);
  },
  expenseDetail: (id: number) =>
    request<AuditExpense>(`/api/audit/expenses/${id}`),
  cars: (params: { keyword?: string }) => {
    const qs = new URLSearchParams();
    if (params.keyword) qs.set('keyword', params.keyword);
    return request<{ items: AuditCarSummary[]; total: number }>(
      `/api/audit/cars?${qs.toString()}`
    );
  },
  carDetail: (id: number) => request<AuditCarDetail>(`/api/audit/cars/${id}`),
};