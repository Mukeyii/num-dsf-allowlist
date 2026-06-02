/**
 * renderWithProviders.tsx — render a component inside the providers most of the
 * app's components need: a fresh QueryClient (retries off), a MemoryRouter, and
 * a known i18n language. Network hooks are mocked per test with vi.mock; this
 * helper only supplies the ambient context.
 */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type Location } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useI18n } from '../stores/i18n.store';

interface ProviderOptions {
  // A path string, or a partial location entry (e.g. with `state`) — both are
  // accepted by MemoryRouter's initialEntries.
  route?: string | Partial<Location>;
  lang?: 'en' | 'de';
}

export function renderWithProviders(
  ui: React.ReactElement,
  opts: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route = '/', lang = 'en', ...renderOptions } = opts;
  useI18n.getState().setLang(lang);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
