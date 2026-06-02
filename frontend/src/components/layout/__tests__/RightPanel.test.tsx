import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: () => ({ data: { status: 'PENDING' } }),
  useApprovalHistory: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [{ id: 'm1' }, { id: 'm2' }] }),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: [] }),
}));

import { RightPanel } from '../RightPanel';

describe('RightPanel', () => {
  it('renders the approval status heading and the membership count', () => {
    renderWithProviders(<RightPanel instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /approval status/i })).toBeInTheDocument();
    // memberships fixture has 2 entries -> count is rendered.
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
