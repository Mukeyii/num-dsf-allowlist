import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { ContactModal } from '../ContactModal';

// Mock useContacts so we can control the array returned on each render.
let contactsArr: any[] = [
  { id: 'c1', email: 'a@b.de', name: 'Original', types: '["MEDIC"]', phone: '', address_line: '', postal_code: '', city: '', country_code: '' },
];
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: contactsArr, isLoading: false }),
  useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ContactModal', () => {
  it('does not overwrite user input when contacts list refetches', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <ContactModal open={true} onClose={() => {}} instanceId="i1" contactId="c1" />
      </Wrapper>,
    );

    const emailInput = screen.getByDisplayValue('a@b.de') as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();

    await user.clear(emailInput);
    await user.type(emailInput, 'new@email.de');
    expect(emailInput.value).toBe('new@email.de');

    // Simulate a background refetch: same record, new array reference.
    contactsArr = [
      { id: 'c1', email: 'a@b.de', name: 'Original', types: '["MEDIC"]', phone: '', address_line: '', postal_code: '', city: '', country_code: '' },
    ];
    rerender(
      <Wrapper>
        <ContactModal open={true} onClose={() => {}} instanceId="i1" contactId="c1" />
      </Wrapper>,
    );

    // User input must NOT be overwritten by the refetch.
    const inputAfter = screen.getByDisplayValue('new@email.de') as HTMLInputElement;
    expect(inputAfter.value).toBe('new@email.de');
  });
});
