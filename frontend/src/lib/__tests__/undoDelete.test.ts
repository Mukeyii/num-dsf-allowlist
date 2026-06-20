/**
 * undoDelete.test.ts — covers undoableDelete: it runs the delete immediately,
 * shows a success toast (with the label substituted) when it resolves, and an
 * error toast when it rejects. sonner is mocked so we can assert which toast
 * fired; the real i18n store supplies the translated, parameter-filled strings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';

const success = vi.hoisted(() => vi.fn());
const error = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success, error } }));

import { undoableDelete } from '../undoDelete';
import { useI18n } from '../../stores/i18n.store';

const t = useI18n.getState().t;

describe('undoableDelete', () => {
  beforeEach(() => {
    success.mockReset();
    error.mockReset();
    useI18n.getState().setLang('en');
  });

  it('invokes the delete function exactly once', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    undoableDelete('Endpoint A', deleteFn);
    await Promise.resolve();
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });

  it('shows the success toast with the label substituted when the delete resolves', async () => {
    const deleteFn = vi.fn().mockResolvedValue('ok');
    undoableDelete('Endpoint A', deleteFn);
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
    expect(success).toHaveBeenCalledWith(t('undoDeleteSuccess', { label: 'Endpoint A' }));
    expect(error).not.toHaveBeenCalled();
  });

  it('shows the error toast when the delete rejects', async () => {
    const deleteFn = vi.fn().mockRejectedValue(new Error('boom'));
    undoableDelete('Cert B', deleteFn);
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    expect(error).toHaveBeenCalledWith(t('undoDeleteFailed', { label: 'Cert B' }));
    expect(success).not.toHaveBeenCalled();
  });
});
