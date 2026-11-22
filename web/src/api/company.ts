import { request } from './client';

export type CompanyInfo = {
  id: number;
  name: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  ust_idnr: string | null;
  tax_number: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
};

export type CompanyInput = Omit<CompanyInfo, 'id'>;

export const companyApi = {
  get: () => request<CompanyInfo>('/api/company'),
  update: (input: CompanyInput) =>
    request<CompanyInfo>('/api/company', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
};