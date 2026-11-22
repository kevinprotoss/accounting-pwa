import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { companyApi, type CompanyInfo } from '../api/company';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function CompanyPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['company'],
    queryFn: companyApi.get,
  });

  const [form, setForm] = useState<CompanyInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: companyApi.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(['company'], updated);
      setForm(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    },
  });

  function set<K extends keyof CompanyInfo>(key: K, value: string) {
    if (!form) return;
    setForm({ ...form, [key]: value });
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { id, ...input } = form;
    mutation.mutate(input);
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-600">
        {t('message.load_failed', { error: String(error) })}
      </p>
    );
  }
  if (!form) {
    return <p className="text-sm text-slate-500">{t('common.no_data')}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <div className="space-y-4 pb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('company.company_info')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('company.name')}>
              <input
                className={inputClass}
                value={form.name ?? ''}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label={t('company.street')}>
              <input
                className={inputClass}
                value={form.street ?? ''}
                onChange={(e) => set('street', e.target.value)}
              />
            </Field>
            <Field label={t('company.postcode')}>
              <input
                className={inputClass}
                value={form.postcode ?? ''}
                onChange={(e) => set('postcode', e.target.value)}
              />
            </Field>
            <Field label={t('company.city')}>
              <input
                className={inputClass}
                value={form.city ?? ''}
                onChange={(e) => set('city', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('company.tax_info')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('company.vat_id')}>
              <input
                className={inputClass}
                value={form.ust_idnr ?? ''}
                onChange={(e) => set('ust_idnr', e.target.value)}
              />
            </Field>
            <Field label={t('company.tax_number')}>
              <input
                className={inputClass}
                value={form.tax_number ?? ''}
                onChange={(e) => set('tax_number', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('company.bank_info')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('company.bank_name')}>
              <input
                className={inputClass}
                value={form.bank_name ?? ''}
                onChange={(e) => set('bank_name', e.target.value)}
              />
            </Field>
            <Field label={t('company.iban')}>
              <input
                className={inputClass}
                value={form.iban ?? ''}
                onChange={(e) => set('iban', e.target.value)}
              />
            </Field>
            <Field label={t('company.bic')}>
              <input
                className={inputClass}
                value={form.bic ?? ''}
                onChange={(e) => set('bic', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3 bg-slate-50/95 backdrop-blur border-t border-slate-200 flex items-center gap-3 md:justify-end flex-wrap">
        {saved && (
          <span className="text-sm text-green-600">{t('company.saved')}</span>
        )}
        {mutation.error && (
          <span className="text-sm text-red-600">
            {t('company.save_failed', { error: String(mutation.error) })}
          </span>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
        >
          {mutation.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}