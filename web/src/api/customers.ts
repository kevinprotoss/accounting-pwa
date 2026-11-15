import { request } from './client';

export type Customer = {
  id: number;
  name: string;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  ust_idnr: string | null;
  email: string | null;
  phone: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CustomerInput = {
  name: string;
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
  ust_idnr?: string | null;
  email?: string | null;
  phone?: string | null;
};

export const customersApi = {
  list: () => request<Customer[]>('/api/customers'),
  get: (id: number) => request<Customer>(`/api/customers/${id}`),
  create: (input: CustomerInput) =>
    request<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: number, input: CustomerInput) =>
    request<Customer>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: number) =>
    request<void>(`/api/customers/${id}`, { method: 'DELETE' }),
};