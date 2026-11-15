import { request } from './client';

export type StockItem = {
  receipt_item_id: number;
  product_name: string;
  purchase_price: number;
  tax_rate: number;
  received_qty: number;
  issued_qty: number;
  remaining_qty: number;
  receipt_date: string;
  supplier: string | null;
  supplier_invoice: string | null;
};

export const stockApi = {
  list: (forIssueId?: number) =>
    request<StockItem[]>(
      forIssueId ? `/api/stock?forIssue=${forIssueId}` : '/api/stock'
    ),
};