/**
 * CommandPalette.interactions.test.tsx — exercises the palette's command flow:
 * opening on Ctrl+K, filtering by typed query, ArrowDown+Enter running the
 * selected command (navigation + store mutation), Escape closing, and the
 * empty-results state. Data hooks (useInstances/useMe) are mocked; the real
 * Zustand stores (useModals, useCanvasStore) are read back to assert actions
 * fired, and a LocationProbe observes router navigation. Query input changes
 * use fireEvent.change for a single deterministic update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useI18n } from '../../../stores/i18n.store';
import { useModals } from '../../../hooks/useModals';
import { useCanvasStore } from '../../../stores/canvas.store';

vi.mock('../../../hooks/useInstance', () => ({
  useInstances: () => ({ data: [{ id: 'inst-1', label: 'Acme Test' }], isLoading: false }),
}));
vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: { email: 'admin@example.de', isAdmin: true }, isLoading: false }),
}));

import { CommandPalette } from '../CommandPalette';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderPalette() {
  useI18n.getState().setLang('en');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/app/audit']}>
      <QueryClientProvider client={qc}>
        <CommandPalette />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
}

function setQuery(value: string) {
  const input = screen.getByPlaceholderText(/type a command/i);
  fireEvent.change(input, { target: { value } });
}

describe('CommandPalette interactions', () => {
  beforeEach(() => {
    // Reset shared Zustand state so each test starts clean.
    useModals.setState({ open: null, editId: null });
    useCanvasStore.setState({ activeInstanceId: null });
  });

  it('lists navigation and action commands once opened', () => {
    renderPalette();
    openPalette();

    expect(screen.getByText('Go to Canvas')).toBeInTheDocument();
    expect(screen.getByText('Edit Organization')).toBeInTheDocument();
    // Admin-only command is visible because the mocked user is an admin.
    expect(screen.getByText('Approval Review')).toBeInTheDocument();
  });

  it('filters the command list as the query is typed', () => {
    renderPalette();
    openPalette();

    setQuery('contact');

    expect(screen.getByText('Add Contact')).toBeInTheDocument();
    // Unrelated commands are filtered out.
    expect(screen.queryByText('Go to Canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Organization')).not.toBeInTheDocument();
  });

  it('runs the selected command on Enter, navigating via the router', () => {
    renderPalette();
    openPalette();
    expect(screen.getByTestId('location').textContent).toBe('/app/audit');

    // Narrow to a single navigation command, then run it with Enter.
    setQuery('canvas');
    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location').textContent).toBe('/app');
    // Running a command also closes the palette.
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('moves the selection with ArrowDown before running it', () => {
    renderPalette();
    openPalette();

    // Two action commands match "add c": Add Contact, then Add Certificate.
    setQuery('add c');
    expect(screen.getByText('Add Contact')).toBeInTheDocument();
    expect(screen.getByText('Add Certificate')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Second match (Add Certificate) opens the certificate-add modal.
    expect(useModals.getState().open).toBe('certificate-add');
  });

  it('runs the instance-switch command, updating the active instance', () => {
    renderPalette();
    openPalette();

    setQuery('Acme');
    expect(screen.getByText('Switch to Acme Test')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useCanvasStore.getState().activeInstanceId).toBe('inst-1');
    expect(screen.getByTestId('location').textContent).toBe('/app');
  });

  it('closes on Escape', () => {
    renderPalette();
    openPalette();
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('shows the empty-results state for a query with no matches', () => {
    renderPalette();
    openPalette();

    setQuery('zzz-no-such-command');

    expect(screen.getByText('No commands found.')).toBeInTheDocument();
    expect(screen.queryByText('Go to Canvas')).not.toBeInTheDocument();
  });
});
