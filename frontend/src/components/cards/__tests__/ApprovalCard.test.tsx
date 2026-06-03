/**
 * ApprovalCard.test.tsx — renders the approval status/history and opens the
 * approval modal when the submit control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useModals } from '../../../hooks/useModals';

vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: () => ({ data: { status: 'PENDING' } }),
  useApprovalHistory: () => ({
    data: [
      {
        id: 'r1',
        status: 'APPROVED',
        submitted_at: '2026-05-01T00:00:00Z',
        created_at: '2026-05-01T00:00:00Z',
      },
    ],
  }),
}));
vi.mock('../../../hooks/useInstance', () => ({
  useInstances: () => ({ data: [{ id: 'i1', label: 'ukm.de' }] }),
}));

import { ApprovalCard } from '../ApprovalCard';

describe('ApprovalCard', () => {
  it('renders the approval card title and a history entry status', () => {
    renderWithProviders(<ApprovalCard instanceId="i1" />);
    expect(screen.getByText('Approval Summary')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('opens the approval modal when Submit is clicked', async () => {
    renderWithProviders(<ApprovalCard instanceId="i1" />);
    await userEvent.click(screen.getByText('Submit'));
    expect(useModals.getState().open).toBe('approval');
  });
});
