/**
 * StatusPage.test.tsx — instance status overview. All entity hooks are mocked
 * with one-row fixtures; the active instance id is driven through the real
 * canvas store. Asserts the org name heading and the stat cards render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useCanvasStore } from '../../stores/canvas.store';

vi.mock('../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { name: 'UKM', identifier: 'ukm.de' } }),
}));
vi.mock('../../hooks/useContacts', () => ({
  useContacts: () => ({ data: [{ id: 'c1' }] }),
}));
vi.mock('../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [{ identifier: 'e1' }] }),
}));
vi.mock('../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: [{ id: 'cert1', valid_until: '2027-01-01' }] }),
}));
vi.mock('../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [{ id: 'm1' }] }),
}));
vi.mock('../../hooks/useApproval', () => ({
  useApprovalStatus: () => ({ data: { status: 'APPROVED' } }),
  useApprovalHistory: () => ({
    data: [{ id: 'r1', status: 'APPROVED', submitted_at: '2026-05-01T00:00:00Z', created_at: '2026-05-01T00:00:00Z', resolved_at: '2026-05-02T00:00:00Z' }],
  }),
}));

import { StatusPage } from '../StatusPage';

describe('StatusPage', () => {
  beforeEach(() => {
    useCanvasStore.getState().setActiveInstance('i1');
  });

  it('renders the org heading and the approval status section', () => {
    renderWithProviders(<StatusPage />);
    expect(screen.getByRole('heading', { name: 'UKM' })).toBeInTheDocument();
    expect(screen.getByText('Approval Status')).toBeInTheDocument();
  });
});
