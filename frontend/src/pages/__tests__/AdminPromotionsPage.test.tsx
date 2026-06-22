/**
 * AdminPromotionsPage.test.tsx — pending 4-eyes admin-promotion approvals.
 * adminPromotionsApi.list is mocked with one PENDING request and useMe is mocked
 * to an admin from a different site than the requester (so Approve is enabled).
 * Asserts the request card renders, then drives the approve action (open modal →
 * enter 6-digit TOTP → confirm) and asserts adminPromotionsApi.approve is called
 * with the request id and the entered code. A second case covers the same-site
 * guard disabling Approve.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { PromotionRequest } from '../../api/admin.api';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useMe', () => ({ useMe }));

const { listMock, approveMock, rejectMock, cancelMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  approveMock: vi.fn().mockResolvedValue({}),
  rejectMock: vi.fn().mockResolvedValue({}),
  cancelMock: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../api/admin.api', () => ({
  adminPromotionsApi: {
    list: listMock,
    create: vi.fn(),
    approve: approveMock,
    reject: rejectMock,
    cancel: cancelMock,
  },
}));

import { AdminPromotionsPage } from '../AdminPromotionsPage';

function request(over: Partial<PromotionRequest> = {}): PromotionRequest {
  return {
    id: 'req-1',
    target_email: 'candidate@imi-b.example.de',
    requested_by: 'alice@imi-b.example.de',
    requested_at: '2026-06-22T08:00:00Z',
    status: 'PENDING',
    approver_b: null,
    approved_at: null,
    rejected_by: null,
    rejection_reason: null,
    resolved_at: null,
    ...over,
  };
}

describe('AdminPromotionsPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue([request()]);
    approveMock.mockClear();
    rejectMock.mockClear();
    cancelMock.mockClear();
    // Viewer is on imi-a, requester on imi-b → different site → Approve enabled.
    useMe.mockReturnValue({ data: { email: 'reviewer@imi-a.example.de', isAdmin: true } });
  });

  it('renders the title and a pending promotion request card', async () => {
    renderWithProviders(<AdminPromotionsPage />);

    expect(screen.getByRole('heading', { name: 'Admin promotion approvals' })).toBeInTheDocument();

    // The request card renders the target email and the requester from mocked data.
    expect(await screen.findByText('candidate@imi-b.example.de')).toBeInTheDocument();
    expect(screen.getByText('alice@imi-b.example.de')).toBeInTheDocument();
  });

  it('approves a request: confirm fires adminPromotionsApi.approve with the id and TOTP code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPromotionsPage />);

    const approveBtn = await screen.findByRole('button', { name: 'Approve' });
    expect(approveBtn).not.toBeDisabled();
    await user.click(approveBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Approve admin promotion')).toBeInTheDocument();
    expect(within(dialog).getByText('candidate@imi-b.example.de')).toBeInTheDocument();

    const totpInput = within(dialog).getByPlaceholderText('000000');
    fireEvent.change(totpInput, { target: { value: '246810' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('req-1', '246810'), {
      timeout: 4000,
    });
  });

  it('disables Approve when the reviewer is on the same site as the requester', async () => {
    // Viewer shares the imi-b domain with the requester → 4-eyes guard disables Approve.
    useMe.mockReturnValue({ data: { email: 'reviewer@imi-b.example.de', isAdmin: true } });
    renderWithProviders(<AdminPromotionsPage />);

    const approveBtn = await screen.findByRole('button', { name: 'Approve' });
    expect(approveBtn).toBeDisabled();
  });
});
