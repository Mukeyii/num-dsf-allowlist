/**
 * undoDelete.ts – Instant delete with success/error toast
 */
import { toast } from 'sonner';

/**
 * Execute the delete immediately and show a success/error toast.
 * The previous 10-second undo delay has been removed for instant UX.
 */
export function undoableDelete(
  label: string,
  deleteFn: () => Promise<unknown>,
): void {
  deleteFn()
    .then(() => toast.success(`${label} deleted.`))
    .catch(() => toast.error(`Failed to delete ${label}.`));
}
