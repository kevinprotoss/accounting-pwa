import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import IssueList from '../components/IssueList';
import IssueForm from '../components/IssueForm';
import { currentMonth, defaultFilter, type ListFilter } from '../lib/listFilter';

type EditingState = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; id: number };

export default function IssuesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingState>({ mode: 'list' });
  const [justSavedIssueId, setJustSavedIssueId] = useState<number | null>(null);
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
      <IssueList
        filter={filter}
        onFilterChange={patchFilter}
        onFilterClear={clearFilter}
        expandedMonths={expandedMonths}
        onExpandedChange={setExpandedMonths}
        onCreate={() => setEditing({ mode: 'new' })}
        onEdit={(id) => setEditing({ mode: 'edit', id })}
        autoWaitId={justSavedIssueId}
        onAutoWaitConsumed={() => setJustSavedIssueId(null)}
      />
    );
  }

  return (
    <IssueForm
      issueId={editing.mode === 'edit' ? editing.id : null}
      onClose={() => setEditing({ mode: 'list' })}
      onSaved={(newId) => {
        queryClient.invalidateQueries({ queryKey: ['issues'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        setJustSavedIssueId(newId);
        setEditing({ mode: 'list' });
      }}
    />
  );
}