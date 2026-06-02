/**
 * undoDelete.ts – Instant delete with success/error toast
 */
import { toast } from 'sonner';
import { useI18n } from '../stores/i18n.store';

/**
 * Execute the delete immediately and show a success/error toast.
 * The previous 10-second undo delay has been removed for instant UX.
 */
export function undoableDelete(
  label: string,
  deleteFn: () => Promise<unknown>,
): void {
  const { t } = useI18n.getState();
  deleteFn()
    .then(() => toast.success(t('undoDeleteSuccess', { label })))
    .catch(() => toast.error(t('undoDeleteFailed', { label })));
}
