import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
        label: '停用',
        onSelect: () => setConfirmState({ type: 'deactivate', car: c }),
      });
    } else {
      list.push({
        key: 'reactivate',
        label: '启用',
        onSelect: () => setConfirmState({ type: 'reactivate', car: c }),
      });
    }
    list.push({
      key: 'delete',
      label: '删除',
      danger: true,
      onSelect: () => setDeleting(c),
    });
    return list;
  }

  function ruleLabel(c: Car) {
    return c.tax_rule_percent === 0.25 ? '0.25%（电车）' : '1%';
  }

  const confirmTitle =
    confirmState?.type === 'deactivate'
      ? '停用车辆'
      : confirmState?.type === 'reactivate'
      ? '启用车辆'
      : '';

  const confirmMessage =
    confirmState?.type === 'deactivate'
      ? `停用后不再生成新月份记录，历史记录保留，可随时启用。确定停用「${confirmState.car.license_plate}」？`
      : confirmState?.type === 'reactivate'
      ? `启用后从下个月开始生成记录，停用期间的月份不补。确定启用「${confirmState.car.license_plate}」？`
      : '';

  const confirmLabel =
    confirmState?.type === 'deactivate'
      ? '停用'
      : confirmState?.type === 'reactivate'
      ? '启用'
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
          {isLoading ? '加载中…' : `共 ${data.length} 辆车`}
        </p>
        <button
          onClick={onCreate}
          className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
        >
          + 添加车辆
        </button>
      </div>

      {error && <p className="text-sm text-red-600">加载失败：{String(error)}</p>}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          暂无车辆。点击右上角「添加车辆」录入公司车，用于 1% 或 0.25% 规则计算。
        </div>
      )}

      {deleteMutation.error && (
        <p className="text-sm text-red-600">删除失败：{String(deleteMutation.error)}</p>
      )}
      {deactivateMutation.error && (
        <p className="text-sm text-red-600">停用失败：{String(deactivateMutation.error)}</p>
      )}
      {reactivateMutation.error && (
        <p className="text-sm text-red-600">启用失败：{String(reactivateMutation.error)}</p>
      )}

      {/* 桌面表格 */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">车牌号</th>
              <th className="px-4 py-2 text-right">总价（Brutto）</th>
              <th className="px-4 py-2 text-left">规则</th>
              <th className="px-4 py-2 text-left">购车日期</th>
              <th className="px-4 py-2 text-center">状态</th>
              <th className="px-4 py-2 text-right">月度记录</th>
              <th className="px-4 py-2 text-right w-16">操作</th>
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
                      在用
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      已停用
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.expenses.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span>
                      {c.expenses.length} 条 /{' '}
                      {formatMoney(c.expenses.reduce((s, e) => s + e.amount, 0))} €
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
                    电车
                  </span>
                )}
                {c.active === 1 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">
                    在用
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                    已停用
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                总价 {formatMoney(c.gross_list_price)} € · {ruleLabel(c)} · 购车{' '}
                {c.acquisition_date}
              </div>
            </div>

            <div className="border-t border-slate-100 px-3 py-2">
              <div className="text-xs font-medium text-slate-600 mb-1">
                月度记录
              </div>
              {c.expenses.length === 0 ? (
                <p className="text-xs text-slate-400">暂无月度记录</p>
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
        title="删除车辆"
        message={
          deleting
            ? `该车已有 ${deleting.expenses.length} 条月度记录，删除后一并移除，不可恢复。确定删除「${deleting.license_plate}」？`
            : ''
        }
        confirmLabel="删除"
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