/**
 * AdminPage.test.tsx — admin approval review page. useMe (isAdmin) and
 * usePendingApprovals are mocked so the page's branches can be exercised in
 * isolation; RequestCard is stubbed to a marker so assertions stay on
 * AdminPage's own header, banners, count line, and state branches. Covers the
 * admin header/four-eyes banner, empty state, populated count + card render,
 * error (403 vs generic) and loading branches, and the non-admin redirect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { PendingRequest } from '../../api/admin.api';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useMe', () => ({ useMe }));

const usePendingApprovals = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAdmin', () => ({ usePendingApprovals }));

// Stub RequestCard so the page test does not pull in its mutation hooks/toast;
// it echoes the request id so we can assert one card per request.
vi.mock('../../components/admin/RequestCard', () => ({
  RequestCard: ({ request }: { request: { id: string } }) => (
    <div data-testid="request-card">card:{request.id}</div>
  ),
}));

import { AdminPage } from '../AdminPage';

function makeRequest(id: string): PendingRequest {
  return {
    id,
    status: 'PENDING',
    submitted_at: '2026-06-01T00:00:00Z',
    snapshot_json: null,
    signatures: [],
  };
}

type QueryResult = {
  data?: PendingRequest[];
  isLoading: boolean;
  error: unknown;
};

function setQuery(result: Partial<QueryResult>): void {
  usePendingApprovals.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...result,
  });
}

describe('AdminPage', () => {
  beforeEach(() => {
    useMe.mockReset();
    usePendingApprovals.mockReset();
    useMe.mockReturnValue({ data: { email: 'admin@imi.example.de', isAdmin: true } });
  });

  it('renders the admin header and four-eyes banner with no pending requests', () => {
    setQuery({ data: [] });
    renderWithProviders(<AdminPage />);

    expect(screen.getByRole('heading', { name: 'Approval Review' })).toBeInTheDocument();
    expect(
      screen.getByText('Review and action pending approval requests from DSF participants'),
    ).toBeInTheDocument();
    expect(screen.getByText('4-eyes approval principle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin guide/ })).toHaveAttribute(
      'href',
      '/app/admin/help',
    );

    // Empty state, no cards.
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
    expect(screen.getByText('All approval requests have been processed.')).toBeInTheDocument();
    expect(screen.queryByTestId('request-card')).not.toBeInTheDocument();
  });

  it('renders the plural count line and one card per pending request', () => {
    setQuery({ data: [makeRequest('req-a'), makeRequest('req-b')] });
    renderWithProviders(<AdminPage />);

    expect(screen.getByText('2 pending requests')).toBeInTheDocument();
    const cards = screen.getAllByTestId('request-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('card:req-a');
    expect(cards[1]).toHaveTextContent('card:req-b');
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
  });

  it('renders the singular count line for a single pending request', () => {
    setQuery({ data: [makeRequest('only')] });
    renderWithProviders(<AdminPage />);

    expect(screen.getByText('1 pending request')).toBeInTheDocument();
    expect(screen.queryByText(/pending requests/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('request-card')).toHaveLength(1);
  });

  it('shows the access-denied message for a 403 error and suppresses other states', () => {
    setQuery({ error: { response: { status: 403 } } });
    renderWithProviders(<AdminPage />);

    expect(
      screen.getByText('Access denied. You do not have admin privileges.'),
    ).toBeInTheDocument();
    // Header still renders, but no empty/loading state while an error is shown.
    expect(screen.getByRole('heading', { name: 'Approval Review' })).toBeInTheDocument();
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading pending requests…')).not.toBeInTheDocument();
  });

  it('shows the generic load-failed message for a non-403 error', () => {
    setQuery({ error: { response: { status: 500 } } });
    renderWithProviders(<AdminPage />);

    expect(
      screen.getByText('Failed to load pending requests. Please try again later.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Access denied. You do not have admin privileges.'),
    ).not.toBeInTheDocument();
  });

  it('shows the loading state while the request list is loading', () => {
    setQuery({ isLoading: true });
    renderWithProviders(<AdminPage />);

    expect(screen.getByText('Loading pending requests…')).toBeInTheDocument();
    expect(screen.queryByTestId('request-card')).not.toBeInTheDocument();
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
  });

  it('redirects a non-admin user away, rendering none of the admin page', () => {
    useMe.mockReturnValue({ data: { email: 'user@site.example.de', isAdmin: false } });
    setQuery({ data: [] });
    renderWithProviders(<AdminPage />);

    // The <Navigate replace> short-circuits before any page markup renders.
    expect(screen.queryByRole('heading', { name: 'Approval Review' })).not.toBeInTheDocument();
    expect(screen.queryByText('4-eyes approval principle')).not.toBeInTheDocument();
    expect(screen.queryByText('No pending requests')).not.toBeInTheDocument();
  });
});
