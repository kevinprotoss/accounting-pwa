import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ExpenseList from '../components/ExpenseList';
import ExpenseForm from '../components/ExpenseForm';
import { currentMonth, defaultFilter, type ListFilter } from '../lib/listFilter';

type EditingState = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; id: number };

export default function ExpensesPage() {
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
      <ExpenseList
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
    <ExpenseForm
      expenseId={editing.mode === 'edit' ? editing.id : null}
      onClose={() => setEditing({ mode: 'list' })}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['tax'] });
        setEditing({ mode: 'list' });
      }}
    />
  );
}