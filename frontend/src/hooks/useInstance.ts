import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../api/entities.api';
import { useCanvasStore } from '../stores/canvas.store';
import { useAuthStore } from '../stores/auth.store';

export function useInstances() {
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);
  const activeInstanceId  = useCanvasStore((s) => s.activeInstanceId);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['instances'],
    queryFn: () =>
      api('_').getInstances().then(r => r.data.data as { id: string; label: string }[]),
    enabled: !!user,
  });

  useEffect(() => {
    if (query.data?.length && !activeInstanceId) {
      setActiveInstance(query.data[0].id);
    }
  }, [query.data, activeInstanceId]);

  return query;
}
