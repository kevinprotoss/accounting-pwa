import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ReceiptList from '../components/ReceiptList';
import ReceiptForm from '../components/ReceiptForm';
import { currentMonth, defaultFilter, type ListFilter } from '../lib/listFilter';

type EditingState = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; id: number };

export default function ReceiptsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingState>({ mode: 'list' });
  const [filter, setFilter] = useState<ListFilter>(defaultFilter);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([currentMonth()])
  );

  function patchFilter(next: Partial<ListFilter>) {
    setFilter((prev) => ({ ...prev, ...next }));
  }

  function clearFilter() {
    setFilter(defaultFilter);
  }

  if (editing.mode === 'list') {
    return (
      <ReceiptList
        filter={filter}
        onFilterChange={patchFilter}
        onFilterClear={clearFilter}
        expandedMonths={expandedMonths}
        onExpandedChange={setExpandedMonths}
        onCreate={() => setEditing({ mode: 'new' })}
        onEdit={(id) => setEditing({ mode: 'edit', id })}
      />
    );
  }

  return (
    <ReceiptForm
      receiptId={editing.mode === 'edit' ? editing.id : null}
      onClose={() => setEditing({ mode: 'list' })}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        setEditing({ mode: 'list' });
      }}
    />
  );
}