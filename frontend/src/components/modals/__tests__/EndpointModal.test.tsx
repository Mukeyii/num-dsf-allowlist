import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { EndpointModal } from '../EndpointModal';

let endpointsArr: any[] = [
  {
    identifier: 'ep1',
    name: 'Original',
    address: 'https://orig.example.de/dsf',
    ipAddresses: [{ ip: '10.0.0.1', isFhir: true, isBpe: false }],
  },
];

vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: endpointsArr, isLoading: false }),
  useCreateEndpoint: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEndpoint: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteEndpoint: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('EndpointModal', () => {
  it('does not overwrite user input when endpoints list refetches', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <EndpointModal open={true} onClose={() => {}} instanceId="i1" endpointId="ep1" />
      </Wrapper>,
    );

    const addressInput = screen.getByDisplayValue('https://orig.example.de/dsf') as HTMLInputElement;
    await user.clear(addressInput);
    await user.type(addressInput, 'https://new.example.de/dsf');
    expect(addressInput.value).toBe('https://new.example.de/dsf');

    // Simulate background refetch: same data, new array reference.
    endpointsArr = [...endpointsArr];
    rerender(
      <Wrapper>
        <EndpointModal open={true} onClose={() => {}} instanceId="i1" endpointId="ep1" />
      </Wrapper>,
    );

    expect(
      (screen.getByDisplayValue('https://new.example.de/dsf') as HTMLInputElement).value,
    ).toBe('https://new.example.de/dsf');
  });
});
