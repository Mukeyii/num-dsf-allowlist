import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EndpointModal } from '../EndpointModal';

const initialEndpoints = () => [
  {
    identifier: 'ep1',
    name: 'Original',
    address: 'https://orig.example.de/dsf',
    ipAddresses: [{ ip: '10.0.0.1', isFhir: true, isBpe: false }],
  },
];
let endpointsArr: any[] = initialEndpoints();

// Reset the mutable fixture before each test so order/shuffle cannot leak the
// refetch test's mutation into the others.
beforeEach(() => { endpointsArr = initialEndpoints(); });

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

describe('EndpointModal open/close', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Wrapper>
        <EndpointModal open={false} onClose={() => {}} instanceId="i1" />
      </Wrapper>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the add title and an identifier field when open', () => {
    render(
      <Wrapper>
        <EndpointModal open onClose={() => {}} instanceId="i1" />
      </Wrapper>,
    );
    expect(screen.getByRole('heading', { name: /add new endpoint/i })).toBeInTheDocument();
    expect(screen.getByTestId('endpoint-identifier-input')).toBeInTheDocument();
  });
});

describe('EndpointModal', () => {
  it('does not overwrite user input when endpoints list refetches', async () => {
    const { rerender } = render(
      <Wrapper>
        <EndpointModal open={true} onClose={() => {}} instanceId="i1" endpointId="ep1" />
      </Wrapper>,
    );

    const addressInput = screen.getByDisplayValue('https://orig.example.de/dsf') as HTMLInputElement;
    // Set the value atomically — char-by-char typing races under CI load and
    // can truncate the string; this test only needs the field to hold an edit.
    fireEvent.change(addressInput, { target: { value: 'https://new.example.de/dsf' } });
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
