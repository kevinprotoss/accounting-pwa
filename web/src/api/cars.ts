import { request } from './client';

export type CarExpense = {
  month: string;
  amount: number;
  tax_rule_percent: number;
};

export type Car = {
  id: number;
  license_plate: string;
  gross_list_price: number;
  acquisition_date: string;
  active: number;
  tax_rule_percent: number;
  deactivated_at: string | null;
  reactivated_at: string | null;
  expenses: CarExpense[];
};

export type CarInput = {
  license_plate: string;
  gross_list_price: number;
  acquisition_date: string;
  tax_rule_percent: number;
};

export const carsApi = {
  list: () => request<Car[]>('/api/cars'),
  create: (input: CarInput) =>
    request<Car>('/api/cars', { method: 'POST', body: JSON.stringify(input) }),
  deactivate: (id: number) =>
    request<Car>(`/api/cars/${id}/deactivate`, { method: 'PUT' }),
  reactivate: (id: number) =>
    request<Car>(`/api/cars/${id}/reactivate`, { method: 'PUT' }),
  remove: (id: number) =>
    request<void>(`/api/cars/${id}`, { method: 'DELETE' }),
  ensureExpenses: () =>
    request<{ created: number; skipped: number }>('/api/cars/ensure-expenses', {
      method: 'POST',
    }),
};