/**
 * SearchBar.test.tsx — renders the global SearchBar with all five entity hooks
 * mocked to known fixtures. Asserts the placeholder renders and that typing a
 * matching query surfaces a result. Uses fireEvent.change to set the input value
 * in one shot (avoids char-by-char typing races in CI).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { name: 'Uniklinik Muenster', identifier: 'ukm.de' } }),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: [{ name: 'Ada Lovelace', email: 'ada@ukm.de' }] }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({
    data: [{ identifier: 'fhir.ukm.de', name: 'FHIR', address: 'https://fhir.ukm.de' }],
  }),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [] }),
}));

import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('renders the search input with its placeholder', () => {
    renderWithProviders(<SearchBar />);
    expect(screen.getByPlaceholderText(/search entities/i)).toBeInTheDocument();
  });

  it('shows a matching contact result when a query is typed', () => {
    renderWithProviders(<SearchBar />);
    const input = screen.getByPlaceholderText(/search entities/i);
    fireEvent.change(input, { target: { value: 'ada' } });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
