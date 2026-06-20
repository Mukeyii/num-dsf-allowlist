/**
 * MarketplaceEditStatusModal.test.tsx — covers the admin meta editor: it
 * prefills from the passed entry, and on submit it parses the comma-separated
 * array fields into trimmed, non-empty arrays (empty input → []) and forwards
 * the body through updateMeta. useUpdateMarketplaceMeta is mocked so no network
 * is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { MarketplaceEntry } from '../../../api/marketplace.api';

const mutateAsync = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useMarketplace', () => ({
  useUpdateMarketplaceMeta: () => ({ mutateAsync, isPending: false }),
}));

import { MarketplaceEditStatusModal } from '../MarketplaceEditStatusModal';

const entry = {
  processIdentifiers: ['proc.a', 'proc.b'],
  requiredRoles: ['DIC'],
  messageNames: [],
  dsfVersionMin: '1.5',
} as unknown as MarketplaceEntry;

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

describe('MarketplaceEditStatusModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <MarketplaceEditStatusModal
        open={false}
        onClose={() => {}}
        entryId="e1"
        currentStatus="APPROVED"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('submits parsed CSV arrays through updateMeta (trimmed, empty → [])', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <MarketplaceEditStatusModal
        open
        onClose={onClose}
        entryId="e1"
        currentStatus="APPROVED"
        slug="my-proc"
        entry={entry}
      />,
    );

    // Process identifiers prefilled from the entry, with whitespace added by the
    // admin around a new value — splitCsv should trim each segment.
    const procInput = screen.getByLabelText(/process identifiers/i);
    await user.clear(procInput);
    await user.type(procInput, '  proc.a ,  proc.c  ');

    await user.type(screen.getByPlaceholderText('000000'), '654321');
    await user.click(screen.getByRole('button', { name: /edit metadata/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.id).toBe('e1');
    expect(arg.slug).toBe('my-proc');
    // CSV → trimmed array; required roles carried from the prefill; empty
    // messageNames input → [].
    expect(arg.body.processIdentifiers).toEqual(['proc.a', 'proc.c']);
    expect(arg.body.requiredRoles).toEqual(['DIC']);
    expect(arg.body.messageNames).toEqual([]);
    expect(arg.body.status).toBe('APPROVED');
    expect(arg.body.totpCode).toBe('654321');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('sends [] for a cleared array field and changes the DSF status', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MarketplaceEditStatusModal
        open
        onClose={() => {}}
        entryId="e2"
        currentStatus="APPROVED"
        entry={entry}
      />,
    );

    const procInput = screen.getByLabelText(/process identifiers/i);
    await user.clear(procInput);

    await user.selectOptions(screen.getByLabelText(/^status/i), 'DEPRECATED');
    await user.type(screen.getByPlaceholderText('000000'), '111111');
    await user.click(screen.getByRole('button', { name: /edit metadata/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0][0].body;
    expect(body.processIdentifiers).toEqual([]);
    expect(body.status).toBe('DEPRECATED');
  });
});
