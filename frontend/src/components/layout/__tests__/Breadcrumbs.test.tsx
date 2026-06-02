import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { Breadcrumbs } from '../Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders nothing on the top-level route', () => {
    const { container } = renderWithProviders(<Breadcrumbs />, { route: '/app' });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled trail on a sub-route', () => {
    renderWithProviders(<Breadcrumbs />, { route: '/app/audit' });
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    // First segment ("app") is a link, last segment ("audit") is plain text.
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/app');
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });
});
