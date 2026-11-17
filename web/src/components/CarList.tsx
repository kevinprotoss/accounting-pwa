import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { carsApi, type Car } from '../api/cars';
import { formatMoney } from '../lib/utils';
import ActionMenu, { type Action } from './ActionMenu';
import ConfirmDialog from './ConfirmDialog';

type Props = {
  onCreate: () => void;
};

type ConfirmState =
  | { type: 'deactivate'; car: Car }
  | { type: 'reactivate'; car: Car }
  | null;

export default function CarList({ onCreate }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['cars'],
    queryFn: carsApi.list,
  });

  const [deleting, setDeleting] = useState<Car | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cars'] });
    queryClient.invalidateQueries({ queryKey: ['tax'] });
  };

  const deactivateMutation = useMutation({
    mutationFn: carsApi.deactivate,
    onSuccess: () => {
      invalidate();
      setConfirmState(null);
    },
    onError: () => {
      setConfirmState(null);
    },
  });
  const reactivateMutation = useMutation({
    mutationFn: carsApi.reactivate,
    onSuccess: () => {
      invalidate();
      setConfirmState(null);
    },
    onError: () => {
      setConfirmState(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: carsApi.remove,
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  function actionsFor(c: Car): Action[] {
    const list: Action[] = [];
    if (c.active === 1) {
      list.push({
        key: 'deactivate',
        label: t('car.action_deactivate'),
        onSelect: () => setConfirmState({ type: 'deactivate', car: c }),
      });
    } else {
      list.push({
        key: 'reactivate',
        label: t('car.action_reactivate'),
        onSelect: () => setConfirmState({ type: 'reactivate', car: c }),
      });
    }
    list.push({
      key: 'delete',
      label: t('common.delete'),
      danger: true,
      onSelect: () => setDeleting(c),
    });
    return list;
  }

  function ruleLabel(c: Car) {
    return c.tax_rule_percent === 0.25
      ? t('car.rule_percent_025')
      : t('car.rule_percent_1');
  }

  const confirmTitle =
    confirmState?.type === 'deactivate'
      ? t('car.deactivate_title')
      : confirmState?.type === 'reactivate'
      ? t('car.reactivate_title')
      : '';

  const confirmMessage =
    confirmState?.type === 'deactivate'
      ? t('car.deactivate_message', { plate: confirmState.car.license_plate })
      : confirmState?.type === 'reactivate'
      ? t('car.reactivate_message', { plate: confirmState.car.license_plate })
      : '';

  const confirmLabel =
    confirmState?.type === 'deactivate'
      ? t('car.action_deactivate')
      : confirmState?.type === 'reactivate'
      ? t('car.action_reactivate')
      : '';

  const confirmLoading =
    confirmState?.type === 'deactivate'
      ? deactivateMutation.isPending
      : confirmState?.type === 'reactivate'
      ? reactivateMutation.isPending
      : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading ? t('common.loading') : t('car.count', { count: data.length })}
        </p>
        <button
          onClick={onCreate}
          className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
        >
          + {t('car.new')}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {t('message.load_failed', { error: String(error) })}
        </p>
      )}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          {t('car.empty_hint')}
        </div>
      )}

      {deleteMutation.error && (
        <p className="text-sm text-red-600">
          {t('car.delete_failed', { error: String(deleteMutation.error) })}
        </p>
      )}
      {deactivateMutation.error && (
        <p className="text-sm text-red-600">
          {t('car.deactivate_failed', { error: String(deactivateMutation.error) })}
        </p>
      )}
      {reactivateMutation.error && (
        <p className="text-sm text-red-600">
          {t('car.reactivate_failed', { error: String(reactivateMutation.error) })}
        </p>
      )}

      {/* 桌面表格 */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">{t('car.license_plate')}</th>
              <th className="px-4 py-2 text-right">{t('car.gross_list_price')}</th>
              <th className="px-4 py-2 text-left">{t('car.rule')}</th>
              <th className="px-4 py-2 text-left">{t('car.acquisition_date')}</th>
              <th className="px-4 py-2 text-center">{t('car.status')}</th>
              <th className="px-4 py-2 text-right">{t('car.monthly_records')}</th>
              <th className="px-4 py-2 text-right w-16">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{c.license_plate}</td>
                <td className="px-4 py-2 text-right">
                  {formatMoney(c.gross_list_price)} €
                </td>
                <td className="px-4 py-2">{ruleLabel(c)}</td>
                <td className="px-4 py-2">{c.acquisition_date}</td>
                <td className="px-4 py-2 text-center">
                  {c.active === 1 ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      {t('car.status_active')}
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {t('car.status_inactive')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.expenses.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span>
                      {t('car.expense_summary', {
                        count: c.expenses.length,
                        total: formatMoney(
                          c.expenses.reduce((s, e) => s + e.amount, 0)
                        ),
                      })}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <ActionMenu actions={actionsFor(c)} contextLabel={c.license_plate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 手机卡片 */}
      <ul className="md:hidden space-y-2">
        {data.map((c) => (
          <li key={c.id} className="relative rounded-lg border border-slate-200 bg-white">
            <div className="p-3 pr-14">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{c.license_plate}</span>
                {c.tax_rule_percent === 0.25 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 shrink-0">
                    {t('car.electric_badge')}
                  </span>
                )}
                {c.active === 1 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">
                    {t('car.status_active')}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                    {t('car.status_inactive')}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t('car.card_summary', {
                  price: formatMoney(c.gross_list_price),
                  rule: ruleLabel(c),
                  date: c.acquisition_date,
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 px-3 py-2">
              <div className="text-xs font-medium text-slate-600 mb-1">
                {t('car.monthly_records')}
              </div>
              {c.expenses.length === 0 ? (
                <p className="text-xs text-slate-400">{t('car.no_records')}</p>
              ) : (
                <ul className="space-y-1">
                  {c.expenses.map((e) => (
                    <li
                      key={e.month}
                      className="flex justify-between text-xs text-slate-600"
                    >
                      <span>{e.month}</span>
                      <span>{formatMoney(e.amount)} €</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="absolute top-1 right-1">
              <ActionMenu actions={actionsFor(c)} contextLabel={c.license_plate} />
            </div>
          </li>
        ))}
      </ul>

      {/* 停用 / 启用确认 */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        loading={confirmLoading}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.type === 'deactivate') {
            deactivateMutation.mutate(confirmState.car.id);
          } else {
            reactivateMutation.mutate(confirmState.car.id);
          }
        }}
        onCancel={() => setConfirmState(null)}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleting}
        title={t('car.delete_title')}
        message={
          deleting
            ? t('car.delete_message', {
                count: deleting.expenses.length,
                plate: deleting.license_plate,
              })
            : ''
        }
        confirmLabel={t('common.delete')}
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}