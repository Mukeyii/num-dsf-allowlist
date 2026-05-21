import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { DownloadModal } from '../DownloadModal';

// Endpoints hook stubbed — we don't exercise endpoint listing here.
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [], isLoading: false }),
}));

// BundlePreview pulls more API state we don't care about for this gate.
vi.mock('../BundlePreview', () => ({
  BundlePreview: () => null,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('DownloadModal disclaimer gate', () => {
  it('renders the disclaimer block and keeps both download buttons disabled initially', () => {
    render(
      <Wrapper>
        <DownloadModal open={true} onClose={() => {}} instanceId="i1" />
      </Wrapper>,
    );

    expect(screen.getByTestId('bundle-disclaimer')).toBeInTheDocument();
    const checkbox = screen.getByTestId('disclaimer-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    expect(screen.getByTestId('download-bundle-btn')).toBeDisabled();
    expect(screen.getByTestId('download-ip-btn')).toBeDisabled();
  });

  it('enables both download buttons once the operator ticks the acknowledgment', () => {
    render(
      <Wrapper>
        <DownloadModal open={true} onClose={() => {}} instanceId="i1" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('disclaimer-checkbox'));

    expect(screen.getByTestId('download-bundle-btn')).toBeEnabled();
    expect(screen.getByTestId('download-ip-btn')).toBeEnabled();
  });
});
