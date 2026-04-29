/**
 * Sidebar.test.tsx – Smoke RTL test proving the test pipeline works.
 * Real coverage comes in Phase 2.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { Sidebar } from '../Sidebar';

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <QueryClientProvider client={qc}>
        <Sidebar />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('renders without throwing', () => {
    renderSidebar();
    expect(document.body.textContent).toBeTruthy();
  });
});
