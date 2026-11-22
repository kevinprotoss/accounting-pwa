import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { carsApi } from '../api/cars';
import CarList from '../components/CarList';
import CarForm from '../components/CarForm';

type EditingState = { mode: 'list' } | { mode: 'new' };

export default function CarsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingState>({ mode: 'list' });

  useEffect(() => {
    carsApi
      .ensureExpenses()
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['cars'] });
        queryClient.invalidateQueries({ queryKey: ['tax'] });
      })
      .catch(() => {
        // ensure 失败不影响列表展示
      });
  }, []);

  if (editing.mode === 'list') {
    return <CarList onCreate={() => setEditing({ mode: 'new' })} />;
  }

  return (
    <CarForm
      onClose={() => setEditing({ mode: 'list' })}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ['cars'] });
        queryClient.invalidateQueries({ queryKey: ['tax'] });
        setEditing({ mode: 'list' });
      }}
    />
  );
}