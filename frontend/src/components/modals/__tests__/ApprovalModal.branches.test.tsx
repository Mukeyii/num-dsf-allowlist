/**
 * ApprovalModal.branches.test.tsx — covers the submit-path branches the base
 * ApprovalModal.test.tsx does not: a fully-passing checklist enabling submit,
 * the success path (guard-wrapped mutateAsync → success toast + onClose), the
 * ALREADY_PENDING failure mapped to its dedicated toast, the generic failure
 * path (getErrorMessage), and the empty draft state rendering every per-section
 * "no X" placeholder. The cross-user guard is exercised through its real default
 * context (executes the action directly), and sonner is mocked so toast calls
 * are asserted without side effects. The real i18n translator runs, so asserted
 * strings are the actual rendered output.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useI18n } from '../../../stores/i18n.store';

// Hoisted submit double + per-test data state so each hook returns the shape the
// component expects while letting individual tests flip the checklist outcome.
const mutateAsync = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({
  org: null as Record<string, unknown> | null,
  contacts: [] as Record<string, unknown>[],
  endpoints: [] as Record<string, unknown>[],
  certs: [] as Record<string, unknown>[],
  memberships: [] as Record<string, unknown>[],
}));

vi.mock('../../../hooks/useApproval', () => ({
  useSubmitApproval: () => ({ mutate: vi.fn(), mutateAsync, isPending: false }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: data.org, isLoading: false }),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: data.contacts, isLoading: false }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: data.endpoints, isLoading: false }),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: data.certs, isLoading: false }),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: data.memberships, isLoading: false }),
}));

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

import { ApprovalModal } from '../ApprovalModal';

const t = useI18n.getState().t;

/** Populate every entity so all five readiness checks pass and submit enables. */
function seedPassingData() {
  data.org = {
    identifier: 'ukm.de',
    name: 'Uniklinik Münster',
    email: 'dsf@ukm.de',
    city: 'Münster',
    country_code: 'DE',
    active: true,
  };
  data.contacts = [{ id: 'c1', name: 'Dr. House', types: ['MEDIC'], email_validated: true }];
  data.endpoints = [
    { identifier: 'ep-1', name: 'UKM FHIR', address: 'https://ukm.de/fhir', ipAddresses: [] },
  ];
  data.certs = [{ id: 'cert-1', subject: 'CN=ukm.de', valid_until: '2030-01-01' }];
  data.memberships = [{ id: 'm1', parent_organization: 'num.de', roles: ['DIC'] }];
}

function seedEmptyData() {
  data.org = null;
  data.contacts = [];
  data.endpoints = [];
  data.certs = [];
  data.memberships = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  seedEmptyData();
});

describe('ApprovalModal — submit + empty-state branches', () => {
  it('enables submit, runs the guarded mutation, toasts success and closes when every check passes', async () => {
    seedPassingData();
    mutateAsync.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();

    renderWithProviders(<ApprovalModal open onClose={onClose} instanceId="i1" />);

    expect(screen.getByText(t('approvalModalAllPassed'))).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /send request for approval/i });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await waitFor(
      () => expect(toastSuccess).toHaveBeenCalledWith(t('approvalModalSubmitSuccess')),
      {
        timeout: 4000,
      },
    );
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('maps an ALREADY_PENDING failure to the dedicated toast and keeps the modal open', async () => {
    seedPassingData();
    mutateAsync.mockRejectedValueOnce({
      response: { data: { error: { message: 'ALREADY_PENDING' } } },
    });
    const onClose = vi.fn();

    renderWithProviders(<ApprovalModal open onClose={onClose} instanceId="i1" />);

    fireEvent.click(screen.getByRole('button', { name: /send request for approval/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(t('approvalModalAlreadyPending')), {
      timeout: 4000,
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces a generic backend error message on the failure path', async () => {
    seedPassingData();
    mutateAsync.mockRejectedValueOnce({
      response: { data: { error: { message: 'Backend exploded' } } },
    });
    const onClose = vi.fn();

    renderWithProviders(<ApprovalModal open onClose={onClose} instanceId="i1" />);

    fireEvent.click(screen.getByRole('button', { name: /send request for approval/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Backend exploded'), {
      timeout: 4000,
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders every per-section empty placeholder and disables submit for an empty draft', () => {
    const onClose = vi.fn();
    renderWithProviders(<ApprovalModal open onClose={onClose} instanceId="i1" />);

    expect(screen.getByText(t('approvalModalSomeFailed'))).toBeInTheDocument();
    expect(screen.getByText(t('approvalModalNoContacts'))).toBeInTheDocument();
    expect(screen.getByText(t('approvalModalNoEndpoints'))).toBeInTheDocument();
    expect(screen.getByText(t('approvalModalNoCerts'))).toBeInTheDocument();
    expect(screen.getByText(t('approvalModalNoMemberships'))).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /send request for approval/i })).toBeDisabled();
  });
});
