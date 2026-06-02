import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AppFooter } from '../AppFooter';

describe('AppFooter', () => {
  it('renders the affiliation text and a disclaimer link', () => {
    renderWithProviders(<AppFooter />);
    expect(screen.getByText(/Institute of Medical Informatics/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /disclaimer/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/app/legal');
  });
});
