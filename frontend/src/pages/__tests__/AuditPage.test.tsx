/**
 * AuditPage.test.tsx — cross-instance audit log view.
 * useCrossInstanceAudit and useMe are mocked. The audit hook is driven by the
 * page argument so paging changes which rows it returns, letting the tests
 * assert rows render, pagination pages through, and the loading/empty/error and
 * non-admin-redirect states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { AuditEntry, AuditResponse } from '../../api/audit.api';

const useCrossInstanceAudit = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAudit', () => ({ useCrossInstanceAudit }));

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useMe', () => ({ useMe }));

import { AuditPage } from '../AuditPage';

function entry(over: Partial<AuditEntry>): AuditEntry {
  return {
    id: 'e1',
    timestamp: '2026-05-01T10:00:00Z',
    user_email: 'alice@imi.example.de',
    instance_id: 'inst-aaaaaaaa-bbbb',
    resource_type: 'ORGANIZATION',
    resource_id: 'ukm.de',
    operation: 'CREATE',
    diff_json: null,
    ip_address: '10.0.0.1',
    instance_label: 'UKM',
    organization_identifier: 'ukm.de',
    organization_name: 'University Hospital Muenster',
    ...over,
  };
}

function ok(
  rows: AuditEntry[],
  total: number,
): {
  data: AuditResponse;
  isLoading: false;
  error: null;
} {
  return {
    data: { data: rows, meta: { total, page: 1, limit: 50, isAdmin: true } },
    isLoading: false,
    error: null,
  };
}

describe('AuditPage', () => {
  beforeEach(() => {
    useCrossInstanceAudit.mockReset();
    useMe.mockReturnValue({ data: { email: 'admin@imi.example.de', isAdmin: true } });
  });

  it('renders a table row per audit entry from the mocked hook', () => {
    useCrossInstanceAudit.mockReturnValue(
      ok(
        [
          entry({ id: 'e1', resource_type: 'CONTACT', operation: 'UPDATE' }),
          entry({
            id: 'e2',
            resource_type: 'CERTIFICATE',
            operation: 'DELETE',
            user_email: 'bob@imi.example.de',
            ip_address: '10.0.0.2',
          }),
        ],
        2,
      ),
    );

    renderWithProviders(<AuditPage />);

    expect(screen.getByRole('heading', { name: 'Audit Log' })).toBeInTheDocument();
    // Header columns for resource and operation are present.
    expect(screen.getByRole('columnheader', { name: 'Resource' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Operation' })).toBeInTheDocument();

    // One <tr> per entry in the table body (plus the header row).
    expect(screen.getAllByRole('row')).toHaveLength(3);

    // Cell content from both rows is rendered.
    expect(screen.getByText('CONTACT')).toBeInTheDocument();
    expect(screen.getByText('CERTIFICATE')).toBeInTheDocument();
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
    expect(screen.getByText('alice@imi.example.de')).toBeInTheDocument();
    expect(screen.getByText('bob@imi.example.de')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
  });

  it('pages through with the pagination controls', async () => {
    // 120 entries over a page size of 50 → 3 pages. The hook returns a distinct
    // marker row per page so we can prove the page argument is honoured.
    useCrossInstanceAudit.mockImplementation((page: number) =>
      ok(
        [
          entry({
            id: `p${page}`,
            resource_id: `row-on-page-${page}`,
            user_email: `user${page}@imi.de`,
          }),
        ],
        120,
      ),
    );

    renderWithProviders(<AuditPage />);

    // Page 1 of 3, Previous disabled, page-1 marker visible.
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText('user1@imi.de')).toBeInTheDocument();

    // Advance to page 2: marker and counter update, Previous becomes enabled.
    fireEvent.click(next);
    expect(await screen.findByText('user2@imi.de')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(useCrossInstanceAudit).toHaveBeenCalledWith(2, 50, true);

    // Advance to the last page: Next becomes disabled.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('user3@imi.de')).toBeInTheDocument();
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    // Step back down to page 2.
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('user2@imi.de')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('hides pagination controls when a single page of results fits', () => {
    useCrossInstanceAudit.mockReturnValue(ok([entry({ id: 'only' })], 1));

    renderWithProviders(<AuditPage />);

    expect(screen.getByText('alice@imi.example.de')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('shows the loading state while the query is pending', () => {
    useCrossInstanceAudit.mockReturnValue({ data: undefined, isLoading: true, error: null });

    renderWithProviders(<AuditPage />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', () => {
    useCrossInstanceAudit.mockReturnValue(ok([], 0));

    renderWithProviders(<AuditPage />);

    expect(screen.getByText('No audit entries yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error state when the query fails', () => {
    useCrossInstanceAudit.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    });

    renderWithProviders(<AuditPage />);

    expect(screen.getByText('Failed to load audit log.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('redirects a non-admin viewer away from the audit page', () => {
    useMe.mockReturnValue({ data: { email: 'viewer@imi.example.de', isAdmin: false } });
    useCrossInstanceAudit.mockReturnValue(ok([], 0));

    renderWithProviders(<AuditPage />);

    // The page redirects (<Navigate to="/app">) so none of its content renders.
    expect(screen.queryByRole('heading', { name: 'Audit Log' })).not.toBeInTheDocument();
    expect(screen.queryByText('No audit entries yet.')).not.toBeInTheDocument();
  });
});
