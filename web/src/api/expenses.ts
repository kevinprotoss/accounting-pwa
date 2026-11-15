import { request } from './client';

export type Expense = {
  id: number;
  date: string;
  category: string | null;
  description: string | null;
  net_amount: number;
  tax_rate: number;
  input_tax: number;
  is_output_tax: number;
  attachment_path: string | null;
  supplier_invoice: string | null;
  remarks: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ExpenseInput = {
  date: string;
  category: string | null;
  description: string | null;
  net_amount: number;
  tax_rate: number;
  input_tax: number;
  is_output_tax: boolean | number;
  attachment_path: string | null;
  supplier_invoice: string | null;
  remarks: string | null;
};

export const expensesApi = {
  list: () => request<Expense[]>('/api/expenses'),
  get: (id: number) => request<Expense>(`/api/expenses/${id}`),
  create: (input: ExpenseInput) =>
    request<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: ExpenseInput) =>
    request<Expense>(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: number) =>
    request<void>(`/api/expenses/${id}`, { method: 'DELETE' }),
};