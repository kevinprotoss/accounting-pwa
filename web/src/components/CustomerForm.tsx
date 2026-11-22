import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { customersApi, type CustomerInput } from '../api/customers';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900';

function emptyInput(): CustomerInput {
  return {
    name: '',
    street: '',
    postcode: '',
    city: '',
    country: '',
    ust_idnr: '',
    email: '',
    phone: '',
  };
}

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

type Props = {
  customerId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function CustomerForm({ customerId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = customerId !== null;
  const queryClient = useQueryClient();

  const {
    data: existing,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId!),
    enabled: isEdit,
  });

  const [form, setForm] = useState<CustomerInput>(emptyInput());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyInput());
      return;
    }
    if (existing) {
      setForm({
        name: existing.name ?? '',
        street: existing.street ?? '',
        postcode: existing.postcode ?? '',
        city: existing.city ?? '',
        country: existing.country ?? '',
        ust_idnr: existing.ust_idnr ?? '',
        email: existing.email ?? '',
        phone: existing.phone ?? '',
      });
    }
  }, [isEdit, existing]);

  const saveMutation = useMutation({
    mutationFn: (input: CustomerInput) =>
      isEdit ? customersApi.update(customerId!, input) : customersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSaved();
    },
    onError: (err) => setError(String(err)),
  });

  function set<K extends keyof CustomerInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError(t('message.fill_required'));
      return;
    }
    saveMutation.mutate({ ...form, name: form.name.trim() });
  }

  if (isEdit && isLoading) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex items-center justify-center md:left-56">
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-3 md:left-56">
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(loadError) })}
        </p>
        <button
          onClick={onClose}
          className="h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          {t('common.back_to_list')}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col md:left-56">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {isEdit ? t('customer.edit') : t('customer.new')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-3 text-sm text-slate-600 hover:underline whitespace-nowrap"
        >
          {t('common.back_to_list')}
        </button>
      </header>

      <form
        id="customer-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <Field label={`${t('customer.name')} *`}>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label={t('customer.street')}>
              <input
                className={inputClass}
                value={form.street ?? ''}
                onChange={(e) => set('street', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t('customer.postcode')}>
                <input
                  className={inputClass}
                  value={form.postcode ?? ''}
                  onChange={(e) => set('postcode', e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('customer.city')}>
                  <input
                    className={inputClass}
                    value={form.city ?? ''}
                    onChange={(e) => set('city', e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <Field label={t('customer.country')}>
              <input
                className={inputClass}
                value={form.country ?? ''}
                onChange={(e) => set('country', e.target.value)}
              />
            </Field>
            <Field label={t('customer.vat_id')}>
              <input
                className={inputClass}
                value={form.ust_idnr ?? ''}
                onChange={(e) => set('ust_idnr', e.target.value)}
              />
            </Field>
            <Field label={t('customer.email')}>
              <input
                type="email"
                className={inputClass}
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label={t('customer.phone')}>
              <input
                className={inputClass}
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">
        <div className="max-w-3xl mx-auto flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={saveMutation.isPending}
            className="flex-1 md:flex-none md:min-w-[100px] h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
          >
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </footer>
    </div>
  );
}