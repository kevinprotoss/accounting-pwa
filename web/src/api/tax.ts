import { request } from './client';

export type RateBreakdown = Record<string, { net: number; tax: number }>;

export type TaxSummary = {
  domesticNet: number;
  domesticTax: number;
  exportNet: number;
  inputTaxPurchase: number;
  inputTaxExpense: number;
  inputTax: number;
  additionalTax: number;
  totalOutputTax: number;
  vatPayable: number;
  salesByRate: RateBreakdown;
  purchaseByRate: RateBreakdown;
};

export type TaxPeriod = TaxSummary & {
  key: string;
  label: string;
};

export type TaxReport = {
  period: { from: string; to: string; granularity: 'month' | 'quarter' | 'year' };
  summary: TaxSummary;
  periods: TaxPeriod[];
};

export const taxApi = {
  report: (from: string, to: string, granularity: string) =>
    request<TaxReport>(
      `/api/tax?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${granularity}`
    ),
  elsterUrl: (from: string, to: string, granularity: string) =>
    `/api/tax/elster?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${granularity}`,
};