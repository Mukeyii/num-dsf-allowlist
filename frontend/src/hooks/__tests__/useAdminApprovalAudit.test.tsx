/**
 * useAdminApprovalAudit.test.tsx — covers the previously-untested query/mutation
 * hooks in useAdmin, useApproval and useAudit. Each hook's api dependency is
 * mocked (vi.hoisted stubs) so nothing hits the network; reads assert the real
 * unwrapped return value, the enabled gate is exercised by passing null, and
 * mutations assert the api call plus the exact set of query keys invalidated on
 * success (a QueryClient.invalidateQueries spy, mirroring useEntityInvalidation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// --- mocks for the three api modules ---------------------------------------
const getPendingApprovals = vi.hoisted(() => vi.fn());
const approveRequest = vi.hoisted(() => vi.fn());
const rejectRequest = vi.hoisted(() => vi.fn());
vi.mock('../../api/admin.api', () => ({
  adminApi: { getPendingApprovals, approveRequest, rejectRequest },
}));

const getApprovalStatus = vi.hoisted(() => vi.fn());
const getApprovalHistory = vi.hoisted(() => vi.fn());
const submitApproval = vi.hoisted(() => vi.fn());
const apiFactory = vi.hoisted(() => vi.fn());
vi.mock('../../api/entities.api', () => ({ api: apiFactory }));

const getCrossInstanceAudit = vi.hoisted(() => vi.fn());
vi.mock('../../api/audit.api', () => ({ getCrossInstanceAudit }));

import { usePendingApprovals, useApproveRequest, useRejectRequest } from '../useAdmin';
import { useApprovalStatus, useApprovalHistory, useSubmitApproval } from '../useApproval';
import { useCrossInstanceAudit } from '../useAudit';

// A wrapper that exposes its QueryClient so mutation tests can spy on
// invalidateQueries. Returned tuple keeps the render side-effect-free.
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, wrapper };
}

beforeEach(() => {
  getPendingApprovals.mockReset();
  approveRequest.mockReset();
  rejectRequest.mockReset();
  getApprovalStatus.mockReset();
  getApprovalHistory.mockReset();
  submitApproval.mockReset();
  apiFactory.mockReset();
  apiFactory.mockReturnValue({ getApprovalStatus, getApprovalHistory, submitApproval });
  getCrossInstanceAudit.mockReset();
});

// --- useAdmin ---------------------------------------------------------------
describe('usePendingApprovals', () => {
  it('fetches via adminApi.getPendingApprovals() and returns r.data.data', async () => {
    const fixture = [{ id: 'req-1', status: 'PENDING', snapshot_json: null, signatures: [] }];
    getPendingApprovals.mockResolvedValue({ data: { data: fixture } });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => usePendingApprovals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(fixture);
    expect(getPendingApprovals).toHaveBeenCalledTimes(1);
  });

  it('surfaces an empty list when the server returns no pending requests', async () => {
    getPendingApprovals.mockResolvedValue({ data: { data: [] } });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => usePendingApprovals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual([]);
  });
});

describe('useApproveRequest', () => {
  it('calls adminApi.approveRequest and invalidates the decision query keys', async () => {
    approveRequest.mockResolvedValue({ data: { status: 'APPROVED' } });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useApproveRequest(), { wrapper });
    result.current.mutate({ requestId: 'req-9', totpCode: '123456' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(approveRequest).toHaveBeenCalledWith('req-9', '123456');
    // hook unwraps r.data, so the resolved data is the decision payload itself
    expect(result.current.data).toEqual({ status: 'APPROVED' });

    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([
      ['admin', 'pending-approvals'],
      ['network', 'map'],
      ['approval-status'],
      ['approval-history'],
    ]);
  });

  it('does not invalidate when the approval call rejects', async () => {
    approveRequest.mockRejectedValue(new Error('totp invalid'));
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useApproveRequest(), { wrapper });
    result.current.mutate({ requestId: 'req-x', totpCode: '000000' });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useRejectRequest', () => {
  it('calls adminApi.rejectRequest with comment + totp and invalidates the decision keys', async () => {
    rejectRequest.mockResolvedValue({ data: { data: { id: 'req-3', status: 'REJECTED' } } });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useRejectRequest(), { wrapper });
    result.current.mutate({ requestId: 'req-3', comment: 'missing cert', totpCode: '654321' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(rejectRequest).toHaveBeenCalledWith('req-3', 'missing cert', '654321');

    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([
      ['admin', 'pending-approvals'],
      ['network', 'map'],
      ['approval-status'],
      ['approval-history'],
    ]);
  });
});

// --- useApproval ------------------------------------------------------------
describe('useApprovalStatus', () => {
  it('fetches via api(id).getApprovalStatus() and returns r.data.data', async () => {
    const status = { status: 'PENDING', submitted_at: '2026-01-01T00:00:00Z' };
    getApprovalStatus.mockResolvedValue({ data: { data: status } });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useApprovalStatus('inst-7'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(status);
    expect(apiFactory).toHaveBeenCalledWith('inst-7');
    expect(getApprovalStatus).toHaveBeenCalledTimes(1);
  });

  it('stays disabled (no fetch) when instanceId is null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovalStatus(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getApprovalStatus).not.toHaveBeenCalled();
  });
});

describe('useApprovalHistory', () => {
  it('fetches via api(id).getApprovalHistory() and returns r.data.data', async () => {
    const history = [{ id: 'ar-1', status: 'APPROVED' }];
    getApprovalHistory.mockResolvedValue({ data: { data: history } });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useApprovalHistory('inst-8'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(history);
    expect(apiFactory).toHaveBeenCalledWith('inst-8');
    expect(getApprovalHistory).toHaveBeenCalledTimes(1);
  });

  it('stays disabled when instanceId is null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovalHistory(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getApprovalHistory).not.toHaveBeenCalled();
  });
});

describe('useSubmitApproval', () => {
  it('calls api(id).submitApproval() and invalidates status + history for that instance', async () => {
    submitApproval.mockResolvedValue({ data: { data: { status: 'PENDING' } } });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitApproval('inst-5'), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(apiFactory).toHaveBeenCalledWith('inst-5');
    expect(submitApproval).toHaveBeenCalledTimes(1);

    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([
      ['approval-status', 'inst-5'],
      ['approval-history', 'inst-5'],
    ]);
  });
});

// --- useAudit ---------------------------------------------------------------
describe('useCrossInstanceAudit', () => {
  it('fetches via getCrossInstanceAudit({ page, limit }) and returns the response', async () => {
    const response = {
      data: [{ id: 'a-1', operation: 'LOGIN' }],
      meta: { total: 1, page: 2, limit: 25, isAdmin: true },
    };
    getCrossInstanceAudit.mockResolvedValue(response);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCrossInstanceAudit(2, 25), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(response);
    expect(getCrossInstanceAudit).toHaveBeenCalledWith({ page: 2, limit: 25 });
  });

  it('passes its default page/limit when called with no pagination args', async () => {
    getCrossInstanceAudit.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, isAdmin: false },
    });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCrossInstanceAudit(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(getCrossInstanceAudit).toHaveBeenCalledWith({ page: 1, limit: 50 });
  });

  it('stays disabled (no fetch) when enabled is false', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCrossInstanceAudit(1, 50, false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getCrossInstanceAudit).not.toHaveBeenCalled();
  });
});
