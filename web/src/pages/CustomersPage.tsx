import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import CustomerList from '../components/CustomerList';
import CustomerForm from '../components/CustomerForm';

type EditingState = { mode: 'list' } | { mode: 'new' } | { mode: 'edit'; id: number };

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingState>({ mode: 'list' });
  const [search, setSearch] = useState('');

  if (editing.mode === 'list') {
    return (
      <CustomerList
        search={search}
        onSearchChange={setSearch}
        onCreate={() => setEditing({ mode: 'new' })}
        onEdit={(id) => setEditing({ mode: 'edit', id })}
      />
    );
  }

  return (
    <CustomerForm
      customerId={editing.mode === 'edit' ? editing.id : null}
      onClose={() => setEditing({ mode: 'list' })}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setEditing({ mode: 'list' });
      }}
    />
  );
}