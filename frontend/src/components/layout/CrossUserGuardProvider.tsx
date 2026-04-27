/**
 * CrossUserGuardProvider.tsx – Provides the `useCrossUserGuard()` hook by
 * checking whether the active instance is owned by the current user. When
 * an admin acts on a non-owned instance, the wrapped action is queued and
 * the CrossUserConfirmDialog is shown.
 */
import { ReactNode, useCallback, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas.store';
import { useMe } from '../../hooks/useMe';
import { useInstance } from '../../hooks/useInstance';
import { CrossUserGuardContext, GuardFn } from '../../hooks/useCrossUserGuard';
import { CrossUserConfirmDialog } from './CrossUserConfirmDialog';

export function CrossUserGuardProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useCanvasStore((s) => s.activeInstanceId);
  const { data: me } = useMe();
  const { data: instance } = useInstance(activeInstanceId);
  const ownerEmail = (instance as { owner_email?: string | null } | undefined)?.owner_email ?? null;

  const isCrossUser =
    !!me?.isAdmin && !!ownerEmail && !!me.email && ownerEmail !== me.email;

  const [pending, setPending] = useState<null | (() => void | Promise<void>)>(null);

  const guard: GuardFn = useCallback((action) => {
    if (!isCrossUser) {
      void action();
      return;
    }
    setPending(() => action);
  }, [isCrossUser]);

  function confirm() {
    const action = pending;
    setPending(null);
    if (action) void action();
  }
  function cancel() {
    setPending(null);
  }

  return (
    <CrossUserGuardContext.Provider value={guard}>
      {children}
      <CrossUserConfirmDialog
        open={!!pending}
        ownerEmail={ownerEmail}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </CrossUserGuardContext.Provider>
  );
}
