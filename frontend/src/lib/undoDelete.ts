/**
 * undoDelete.ts – Delayed delete with undo capability via toast
 */
import { toast } from 'sonner';

/**
 * Show a toast with undo capability. If not undone within 10s, execute the delete.
 */
export function undoableDelete(
  label: string,
  deleteFn: () => Promise<void>,
): void {
  let cancelled = false;

  const toastId = toast(
    `${label} deleted`,
    {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          cancelled = true;
          toast.dismiss(toastId);
          toast.success(`${label} restored.`);
        },
      },
    },
  );

  // Execute delete after toast duration
  setTimeout(async () => {
    if (!cancelled) {
      try {
        await deleteFn();
      } catch {
        toast.error(`Failed to delete ${label}.`);
      }
    }
  }, 10000);
}
