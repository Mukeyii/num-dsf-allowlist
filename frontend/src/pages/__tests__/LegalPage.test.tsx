/**
 * LegalPage.test.tsx — static legal/disclaimer page; shows the page title and
 * the bundle-verification disclaimer heading. No network involved.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LegalPage } from '../LegalPage';

describe('LegalPage', () => {
  it('renders the legal title and the disclaimer heading', () => {
    renderWithProviders(<LegalPage />, { route: '/app/legal' });
    expect(screen.getByRole('heading', { name: 'Legal — Disclaimer' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Bundle verification is the recipient/i }),
    ).toBeInTheDocument();
  });
});
