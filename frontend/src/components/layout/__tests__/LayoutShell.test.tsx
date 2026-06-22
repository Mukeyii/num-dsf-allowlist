/**
 * LayoutShell.test.tsx — covers the four app-shell layout pieces together:
 * Sidebar (nav links, instance switcher, identity footer, select/keyboard
 * handlers), TopBar (action buttons), SearchBar (input filtering, select
 * handler, org name||identifier label fallback) and Breadcrumbs (the trail).
 * Stores and entity/auth hooks are stubbed so nothing touches the network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useCanvasStore } from '../../../stores/canvas.store';
import { useAuthStore } from '../../../stores/auth.store';

// Sidebar reads the instance list + the current user; stub both.
vi.mock('../../../hooks/useInstance', () => ({
  useInstances: () => ({
    data: [
      { id: 'i1', label: 'alpha.example.de' },
      { id: 'i2', label: 'beta.example.de' },
    ],
    isLoading: false,
  }),
}));
vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: { email: 'op@imi-test.example.de', isAdmin: true }, isLoading: false }),
}));

// SearchBar pulls in every entity hook — stub them all with known fixtures.
vi.mock('../../../hooks/useOrganization', () => ({
  // No `name` on purpose so the org result must fall back to `identifier`.
  useOrganization: () => ({ data: { identifier: 'gamma.example.de' } }),
}));
vi.mock('../../../hooks/useContacts', () => ({ useContacts: () => ({ data: [] }) }));
vi.mock('../../../hooks/useEndpoints', () => ({ useEndpoints: () => ({ data: [] }) }));
vi.mock('../../../hooks/useCertificates', () => ({ useCertificates: () => ({ data: [] }) }));
vi.mock('../../../hooks/useMemberships', () => ({ useMemberships: () => ({ data: [] }) }));

import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import { SearchBar } from '../SearchBar';
import { Breadcrumbs } from '../Breadcrumbs';

describe('Sidebar', () => {
  beforeEach(() => {
    useCanvasStore.setState({ activeInstanceId: null });
    useAuthStore.getState().clearAuth();
  });

  it('renders nav links, the instance switcher and the identity footer', () => {
    useAuthStore.getState().setTokens('tok', { id: 'u1', email: 'op@imi-test.example.de' });
    renderWithProviders(<Sidebar />, { route: '/app' });

    // Nav links — disambiguate the dashboard link by its href (the Status link's
    // icon text is also "dashboard", so the accessible name alone is ambiguous).
    const dashboardLink = screen.getByRole('link', { name: 'grid_view Dashboard' });
    expect(dashboardLink).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /network map/i })).toHaveAttribute('href', '/app/map');
    expect(screen.getByRole('link', { name: /status/i })).toHaveAttribute('href', '/app/status');

    // Instance switcher header + the two instances
    expect(screen.getByText('Instances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'alpha.example.de' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'beta.example.de' })).toBeInTheDocument();

    // Identity footer: email + sign-out control
    expect(screen.getByText('op@imi-test.example.de')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('selecting an instance by click updates the active instance in the store', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />, { route: '/app' });
    expect(useCanvasStore.getState().activeInstanceId).toBeNull();

    await user.click(screen.getByRole('button', { name: 'beta.example.de' }));

    expect(useCanvasStore.getState().activeInstanceId).toBe('i2');
  });

  it('selecting an instance via the keyboard handler updates the store', () => {
    renderWithProviders(<Sidebar />, { route: '/app' });

    fireEvent.keyDown(screen.getByRole('button', { name: 'alpha.example.de' }), { key: 'Enter' });

    expect(useCanvasStore.getState().activeInstanceId).toBe('i1');
  });
});

describe('TopBar', () => {
  it('renders its instance actions when showInstanceActions is set', () => {
    renderWithProviders(<TopBar onDownload={vi.fn()} onApproval={vi.fn()} showInstanceActions />, {
      route: '/app',
    });
    expect(screen.getByText(/Allow List Management/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download allow list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeInTheDocument();
  });

  it('fires onApproval when the approval action is clicked', async () => {
    const user = userEvent.setup();
    const onApproval = vi.fn();
    renderWithProviders(
      <TopBar onDownload={vi.fn()} onApproval={onApproval} showInstanceActions />,
      { route: '/app' },
    );
    await user.click(screen.getByRole('button', { name: /send for approval/i }));
    expect(onApproval).toHaveBeenCalledTimes(1);
  });
});

describe('SearchBar', () => {
  it('filters to an org result using the identifier as the label fallback', () => {
    renderWithProviders(<SearchBar />, { route: '/app' });
    const input = screen.getByPlaceholderText(/search entities/i);

    // Atomic change avoids char-by-char races under heavy CI load.
    fireEvent.change(input, { target: { value: 'gamma' } });

    // No `name` was supplied, so the identifier is the label fallback. The
    // detail line is suppressed in that case, so the identifier must render
    // exactly once — never duplicated across label and detail.
    const option = screen.getByRole('option', { name: /organization: gamma\.example\.de/i });
    expect(within(option).getAllByText('gamma.example.de')).toHaveLength(1);
  });

  it('triggers the canvas highlight when a result is selected', async () => {
    const user = userEvent.setup();
    const highlightSpy = vi.spyOn(useCanvasStore.getState(), 'highlightEntity');
    renderWithProviders(<SearchBar />, { route: '/app' });

    fireEvent.change(screen.getByPlaceholderText(/search entities/i), {
      target: { value: 'gamma' },
    });
    await user.click(screen.getByRole('option', { name: /organization: gamma\.example\.de/i }));

    expect(highlightSpy).toHaveBeenCalledWith('organization');
    highlightSpy.mockRestore();
  });

  it('shows the no-results message for a query with no matches', () => {
    renderWithProviders(<SearchBar />, { route: '/app' });
    fireEvent.change(screen.getByPlaceholderText(/search entities/i), {
      target: { value: 'zzz-nothing' },
    });
    expect(screen.getByText(/no results for/i)).toBeInTheDocument();
  });
});

describe('Breadcrumbs', () => {
  it('renders a labelled trail on a sub-route with the parent as a link', () => {
    renderWithProviders(<Breadcrumbs />, { route: '/app/audit' });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    const parent = screen.getByRole('link', { name: /dashboard/i });
    expect(parent).toHaveAttribute('href', '/app');
    // Last segment is plain text, not a link.
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });
});
