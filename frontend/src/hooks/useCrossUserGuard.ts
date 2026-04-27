/**
 * useCrossUserGuard.ts – Returns `guard(action)` which executes `action`
 * directly when the current user owns the active instance, but opens the
 * CrossUserConfirmDialog otherwise. Powered by a React context provider.
 */
import { createContext, useContext } from 'react';

export type GuardFn = (action: () => void | Promise<void>) => void;

export const CrossUserGuardContext = createContext<GuardFn>((action) => {
  // Default: if no provider mounted (e.g. tests), execute directly.
  void action();
});

export function useCrossUserGuard(): GuardFn {
  return useContext(CrossUserGuardContext);
}
