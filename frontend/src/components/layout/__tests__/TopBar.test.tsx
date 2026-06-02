import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

// SearchBar (rendered when showInstanceActions) pulls in entity hooks — stub them all.
vi.mock('../../../hooks/useOrganization', () => ({ useOrganization: () => ({ data: null }) }));
vi.mock('../../../hooks/useContacts', () => ({ useContacts: () => ({ data: [] }) }));
vi.mock('../../../hooks/useEndpoints', () => ({ useEndpoints: () => ({ data: [] }) }));
vi.mock('../../../hooks/useCertificates', () => ({ useCertificates: () => ({ data: [] }) }));
vi.mock('../../../hooks/useMemberships', () => ({ useMemberships: () => ({ data: [] }) }));

import { TopBar } from '../TopBar';

describe('TopBar', () => {
  it('renders navigation controls without instance actions', () => {
    renderWithProviders(<TopBar onDownload={vi.fn()} onApproval={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByText(/Allow List Management/i)).toBeInTheDocument();
    // Instance-only actions hidden by default.
    expect(screen.queryByRole('button', { name: /send for approval/i })).not.toBeInTheDocument();
  });

  it('renders download and approval actions when showInstanceActions is set', () => {
    const onDownload = vi.fn();
    const onApproval = vi.fn();
    renderWithProviders(
      <TopBar onDownload={onDownload} onApproval={onApproval} showInstanceActions />,
    );
    expect(screen.getByRole('button', { name: /send for approval/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download allow list/i })).toBeInTheDocument();
  });
});
