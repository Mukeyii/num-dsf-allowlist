/**
 * NotFoundPage.test.tsx — static 404 page; shows the "Page Not Found" heading
 * and a back link. No network involved.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { NotFoundPage } from '../NotFoundPage';

describe('NotFoundPage', () => {
  it('renders the not-found heading', () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
  });
});
