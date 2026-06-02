import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { MapOrgList } from '../MapOrgList';
import type { MapOrganization } from '../../../api/network.api';

function org(id: string, name: string, parent: string): MapOrganization {
  return {
    identifier: id,
    name,
    active: true,
    city: 'Berlin',
    country_code: 'DE',
    cert_status: 'VALID',
    endpoints: [],
    memberships: [{ parent_organization: parent, roles: ['DIC'] }],
  };
}

const orgs = [
  org('a.de', 'Alpha Klinik', 'mii-testverband.example.de'),
  org('b.de', 'Beta Klinik', 'mii-testverband.example.de'),
];

describe('MapOrgList', () => {
  it('renders the verbund group header and its members', () => {
    renderWithProviders(<MapOrgList organizations={orgs} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('mii-testverband.example.de')).toBeInTheDocument();
    expect(screen.getByText('Alpha Klinik')).toBeInTheDocument();
    expect(screen.getByText('Beta Klinik')).toBeInTheDocument();
  });

  it('calls onSelect with the org identifier when a member row is clicked', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<MapOrgList organizations={orgs} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('Alpha Klinik'));
    expect(onSelect).toHaveBeenCalledWith('a.de');
  });

  it('shows an empty-state message when there are no organizations', () => {
    renderWithProviders(<MapOrgList organizations={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/No organizations match the current filter/i)).toBeInTheDocument();
  });
});
