/**
 * useInstance.ts — TanStack Query hooks for a single instance and the instance list.
 * Gated on an authenticated user; useInstances auto-selects the first instance as active.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../api/entities.api';
import { useCanvasStore } from '../stores/canvas.store';
import { useAuthStore } from '../stores/auth.store';

export interface InstanceRow {
  id: string;
  label: string;
  owner_email?: string | null;
}

export function useInstance(instanceId: string | null) {
  const user = useAuthStore((s) => s.user);
  return useQuery<InstanceRow>({
    queryKey: ['instances', instanceId],
    queryFn: () =>
      api(instanceId!)
        .getInstance(instanceId!)
        .then((r) => r.data.data as InstanceRow),
    enabled: !!user && !!instanceId,
  });
}

export function useInstances() {
  const setActiveInstance = useCanvasStore((s) => s.setActiveInstance);
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const user = useAuthStore((s) => s.user);

  const query = useQuery({
    queryKey: ['instances'],
    queryFn: () =>
      api('_')
        .getInstances()
        .then((r) => r.data.data as { id: string; label: string }[]),
    enabled: !!user,
  });

  useEffect(() => {
    const list = query.data;
    if (!list) return; // still loading — keep the current selection
    const stillPresent = activeInstanceId != null && list.some((i) => i.id === activeInstanceId);
    if (stillPresent) return;
    // No selection yet, or the active instance vanished from a refetch: fall
    // back to the first instance, or clear when the list is now empty.
    setActiveInstance(list[0]?.id ?? null);
  }, [query.data, activeInstanceId, setActiveInstance]);

  return query;
}
