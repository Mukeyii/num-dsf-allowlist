import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useApproval', () => ({
  useSubmitApproval: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: null, isLoading: false }),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [], isLoading: false }),
}));

import { ApprovalModal } from '../ApprovalModal';

describe('ApprovalModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <ApprovalModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and the readiness checklist when open', () => {
    renderWithProviders(<ApprovalModal open onClose={() => {}} instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /submit for approval/i })).toBeInTheDocument();
    // Submit button is disabled while the checklist has unmet items.
    expect(screen.getByRole('button', { name: /send request for approval/i })).toBeDisabled();
  });
});
