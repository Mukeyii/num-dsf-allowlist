import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../Sidebar';

vi.mock('../../../hooks/useInstance', () => ({
  useInstances: () => ({ data: [{ id: 'i1', label: 'Test Instance' }], isLoading: false }),
}));

vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: { email: 'admin@imi-test.example.de', isAdmin: true }, isLoading: false }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderSidebarFrom(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={qc}>
        <Sidebar />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Sidebar instance switcher', () => {
  it('clicking an instance navigates to /app', async () => {
    const user = userEvent.setup();
    renderSidebarFrom('/app/marketplace');
    expect(screen.getByTestId('location').textContent).toBe('/app/marketplace');

    await user.click(screen.getByText('Test Instance'));

    expect(screen.getByTestId('location').textContent).toBe('/app');
  });
});
