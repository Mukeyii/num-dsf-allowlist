/**
 * OnboardingWizard.test.tsx — renders the wizard with all data hooks mocked so
 * that not every step is complete (the wizard returns null when all are done).
 * Asserts the header and a step label render.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { name: 'Uniklinik', identifier: 'ukm.de' } }),
}));
vi.mock('../../../hooks/useContacts', () => ({
  useContacts: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useCertificates', () => ({
  useCertificates: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useMemberships', () => ({
  useMemberships: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useApproval', () => ({
  useApprovalStatus: () => ({ data: undefined }),
}));

import { OnboardingWizard } from '../OnboardingWizard';

describe('OnboardingWizard', () => {
  it('renders the header and a step label when onboarding is incomplete', () => {
    renderWithProviders(<OnboardingWizard instanceId="i1" />);
    expect(screen.getByText(/getting started/i)).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
  });
});
