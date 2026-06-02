/**
 * useToastMutation.ts — A useMutation wrapper that shows a success toast on
 * completion and an error toast (via getErrorMessage) on failure. Collapses
 * the repeated mutate/toast/invalidate boilerplate on the admin pages.
 */
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/getErrorMessage';

export function useToastMutation<TVars>(opts: {
  mutationFn: (vars: TVars) => Promise<unknown>;
  successMessage: string;
  onSuccess?: () => void;
  errorFallback?: string;
}) {
  return useMutation({
    mutationFn: opts.mutationFn,
    onSuccess: () => {
      toast.success(opts.successMessage);
      opts.onSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, opts.errorFallback ?? 'Failed'));
    },
  });
}
