import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: { email: 'admin@imi-test.example.de', isAdmin: true }, isLoading: false }),
}));

import { MapHeader } from '../../map/MapHeader';

describe('MapHeader', () => {
  it('renders the Network Map title and the admin role badge', () => {
    renderWithProviders(<MapHeader />);
    expect(screen.getByRole('heading', { name: /network map/i })).toBeInTheDocument();
    expect(screen.getByText(/🛡 Admin/)).toBeInTheDocument();
  });
});
