import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { customersApi, type Customer } from '../api/customers';
import ActionMenu, { type Action } from './ActionMenu';
import ConfirmDialog from './ConfirmDialog';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
};

function customerMatchKeyword(c: Customer, kw: string): boolean {
  return [
    c.name,
    c.street,
    c.postcode,
    c.city,
    c.country,
    c.ust_idnr,
    c.email,
    c.phone,
  ].some((v) => v && v.toLowerCase().includes(kw));
}

export default function CustomerList({
  search,
  onSearchChange,
  onCreate,
  onEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.list,
  });

  const [deleting, setDeleting] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((c) => customerMatchKeyword(c, kw));
  }, [data, search]);

  const deleteMutation = useMutation({
    mutationFn: customersApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleting(null);
    },
  });

  function actionsFor(c: Customer): Action[] {
    return [
      { key: 'edit', label: '编辑', onSelect: () => onEdit(c.id) },
      { key: 'delete', label: '删除', danger: true, onSelect: () => setDeleting(c) },
    ];
  }

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索名称、地址、USt-IdNr.、邮箱、电话..."
            className="w-full h-10 rounded-md border border-slate-300 pl-3 pr-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
              aria-label="清空"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading
            ? '加载中…'
            : search.trim()
            ? `共 ${filtered.length} 位客户（筛选）`
            : `共 ${data.length} 位客户`}
        </p>
        <button
          onClick={onCreate}
          className="h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
        >
          + 新建客户
        </button>
      </div>

      {error && <p className="text-sm text-red-600">加载失败：{String(error)}</p>}

      {!isLoading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          暂无客户，点击右上角「新建客户」开始。
        </div>
      )}

      {!isLoading && data.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          没有匹配「{search}」的客户。
          <button
            onClick={() => onSearchChange('')}
            className="ml-2 text-slate-700 underline hover:text-slate-900"
          >
            清除搜索
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* 桌面表格 */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-left">城市</th>
                  <th className="px-3 py-2 text-left">USt-IdNr.</th>
                  <th className="px-3 py-2 text-left">邮箱</th>
                  <th className="px-3 py-2 text-center w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onEdit(c.id)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 text-slate-500">{c.id}</td>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">{c.city ?? '—'}</td>
                    <td className="px-3 py-2">{c.ust_idnr ?? '—'}</td>
                    <td className="px-3 py-2">{c.email ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex justify-center">
                        <ActionMenu actions={actionsFor(c)} contextLabel={c.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手机卡片 */}
          <ul className="md:hidden space-y-2">
            {filtered.map((c) => (
              <li key={c.id} className="relative">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit(c.id);
                    }
                  }}
                  className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 pr-14 hover:bg-slate-50 active:bg-slate-100 cursor-pointer"
                >
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {c.city ?? '—'} · {c.ust_idnr ?? '—'}
                  </div>
                  {c.email && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {c.email}
                    </div>
                  )}
                </div>
                <div className="absolute top-1 right-1">
                  <ActionMenu actions={actionsFor(c)} contextLabel={c.name} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="删除客户"
        message={deleting ? `确定删除客户「${deleting.name}」？此操作不可撤销。` : ''}
        confirmLabel="删除"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />

      {deleteMutation.error && (
        <p className="text-sm text-red-600">删除失败：{String(deleteMutation.error)}</p>
      )}
    </div>
  );
}