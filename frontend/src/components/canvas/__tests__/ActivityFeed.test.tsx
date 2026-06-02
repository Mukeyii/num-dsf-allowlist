/**
 * ActivityFeed.test.tsx — renders the floating activity feed with its data
 * source (entities.api) mocked. With no active instance the query is disabled,
 * so expanding the feed shows the empty state. Asserts the empty-state text.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../api/entities.api', () => ({
  api: () => ({
    getAuditLog: vi.fn().mockResolvedValue({ data: { data: [] } }),
  }),
}));

import { ActivityFeed } from '../ActivityFeed';

describe('ActivityFeed', () => {
  it('shows the empty state when expanded with no entries', () => {
    renderWithProviders(<ActivityFeed />);
    // The toggle button is the only button; clicking it expands the panel.
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });
});
