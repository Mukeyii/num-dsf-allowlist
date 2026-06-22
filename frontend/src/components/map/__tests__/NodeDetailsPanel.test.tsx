import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { NodeDetailsPanel } from '../NodeDetailsPanel';
import type {
  MapOrganization,
  MapClusterGroup,
  MapEndpointAdmin,
  MapMembershipAdmin,
} from '../../../api/network.api';

/** A fully-populated admin org: every admin-only branch is exercised. */
function adminOrg(overrides: Partial<MapOrganization> = {}): MapOrganization {
  const endpoint: MapEndpointAdmin = {
    identifier: 'ep.alpha.de',
    name: 'Alpha FHIR',
    address: 'https://fhir.alpha.de/fhir',
    ips: [
      { ip: '10.0.0.1', is_fhir: true, is_bpe: false },
      { ip: '10.0.0.2', is_fhir: false, is_bpe: true },
    ],
  };
  const membership: MapMembershipAdmin = {
    parent_organization: 'mii-verbund.example.de',
    roles: ['DIC', 'HRP'],
    endpoint_id: 'ep.alpha.de',
  };
  return {
    identifier: 'alpha.de',
    name: 'Alpha Klinik',
    active: true,
    city: 'Münster',
    country_code: 'DE',
    cert_status: 'EXPIRING',
    endpoints: [endpoint],
    memberships: [membership],
    email: 'ops@alpha.de',
    next_cert_expiry: '2026-07-01',
    cert_days_until: 9,
    contacts: [
      { name: 'Dr. Ada', email: 'ada@alpha.de', phone: null, types: ['MEDIC', 'DSF_ADMIN'] },
    ],
    ...overrides,
  };
}

/** A non-admin org: only public endpoint/membership shapes, no admin fields. */
function publicOrg(overrides: Partial<MapOrganization> = {}): MapOrganization {
  return {
    identifier: 'beta.de',
    name: 'Beta Klinik',
    active: false,
    city: 'Berlin',
    country_code: 'DE',
    cert_status: 'VALID',
    endpoints: [{ identifier: 'ep.beta.de', name: 'Beta FHIR' }],
    memberships: [{ parent_organization: 'mii-verbund.example.de', roles: ['DTS'] }],
    ...overrides,
  };
}

describe('NodeDetailsPanel', () => {
  it('renders the org header, active badge and certificate status for an admin org', () => {
    renderWithProviders(
      <NodeDetailsPanel
        org={adminOrg()}
        cluster={null}
        isAdmin
        onClose={vi.fn()}
        onSelectMember={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Alpha Klinik' })).toBeInTheDocument();
    expect(screen.getByText('alpha.de')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    // Certificate label + resolved EXPIRING status text live in one badge div
    // (alongside an icon glyph in a sibling span), so match the combined text
    // with a normalizer that ignores the glyph node.
    expect(
      screen.getByText((_content, el) => {
        if (el?.tagName !== 'DIV') return false;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join('')
          .trim();
        return /^Certificate:\s*Expiring soon$/.test(own);
      }),
    ).toBeInTheDocument();
  });

  it('shows admin-only certificate expiry date and the days-remaining warning', () => {
    renderWithProviders(
      <NodeDetailsPanel
        org={adminOrg()}
        cluster={null}
        isAdmin
        onClose={vi.fn()}
        onSelectMember={vi.fn()}
      />,
    );
    // next_cert_expiry rendered via toLocaleDateString — assert the localized form.
    expect(screen.getByText(new Date('2026-07-01').toLocaleDateString())).toBeInTheDocument();
    // cert_days_until = 9 → "9 days remaining"
    expect(screen.getByText('9 days remaining')).toBeInTheDocument();
    expect(screen.getByText(/expires soon/i)).toBeInTheDocument();
  });

  it('renders admin endpoint address, IP badges, contacts, memberships and location', () => {
    renderWithProviders(
      <NodeDetailsPanel
        org={adminOrg()}
        cluster={null}
        isAdmin
        onClose={vi.fn()}
        onSelectMember={vi.fn()}
      />,
    );
    // Endpoint name + admin-only address.
    expect(screen.getByText('Alpha FHIR')).toBeInTheDocument();
    expect(screen.getByText('https://fhir.alpha.de/fhir')).toBeInTheDocument();
    // IP badges with FHIR/BPE suffixes.
    expect(screen.getByText('10.0.0.1 · FHIR')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.2 · BPE')).toBeInTheDocument();
    // Contacts section (admin only).
    expect(screen.getByText('Dr. Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@alpha.de')).toBeInTheDocument();
    expect(screen.getByText('MEDIC, DSF_ADMIN')).toBeInTheDocument();
    // Memberships: parent org, role badges and admin endpoint_id.
    expect(screen.getByText('mii-verbund.example.de')).toBeInTheDocument();
    expect(screen.getByText('DIC')).toBeInTheDocument();
    expect(screen.getByText('HRP')).toBeInTheDocument();
    // endpoint_id appears both as the membership ref and the endpoint identifier;
    // at least one node carries the membership endpoint reference.
    expect(screen.getAllByText('ep.alpha.de').length).toBeGreaterThan(0);
    // Location section.
    expect(screen.getByText('Münster')).toBeInTheDocument();
    expect(screen.getByText('ops@alpha.de')).toBeInTheDocument();
  });

  it('hides admin-only fields for a non-admin org and shows the inactive badge', () => {
    renderWithProviders(
      <NodeDetailsPanel
        org={publicOrg()}
        cluster={null}
        isAdmin={false}
        onClose={vi.fn()}
        onSelectMember={vi.fn()}
      />,
    );
    expect(screen.getByText('Beta Klinik')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    // Public endpoint name is shown...
    expect(screen.getByText('Beta FHIR')).toBeInTheDocument();
    // ...but no Contacts or Location sections, and no expiry date leak.
    expect(screen.queryByText('Contacts (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('Location')).not.toBeInTheDocument();
    // Cert status renders as "Certificate: Valid" inside one badge div.
    expect(
      screen.getByText((_content, el) => {
        if (el?.tagName !== 'DIV') return false;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join('')
          .trim();
        return /^Certificate:\s*Valid$/.test(own);
      }),
    ).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <NodeDetailsPanel
        org={adminOrg()}
        cluster={null}
        isAdmin
        onClose={onClose}
        onSelectMember={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a cluster summary and fires onSelectMember with the member id', async () => {
    const onSelectMember = vi.fn();
    const cluster: MapClusterGroup = {
      city: 'Hamburg',
      country_code: 'DE',
      members: [
        publicOrg({ identifier: 'm1.de', name: 'Member One' }),
        adminOrg({ identifier: 'm2.de', name: 'Member Two' }),
      ],
      worstStatus: 'EXPIRING',
    };
    renderWithProviders(
      <NodeDetailsPanel
        org={null}
        cluster={cluster}
        isAdmin={false}
        onClose={vi.fn()}
        onSelectMember={onSelectMember}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Hamburg' })).toBeInTheDocument();
    expect(screen.getByText('2 sites in Hamburg')).toBeInTheDocument();
    expect(screen.getByText('Member One')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Member Two'));
    expect(onSelectMember).toHaveBeenCalledWith('m2.de');
  });

  it('is aria-hidden with no content when nothing is selected', () => {
    const { container } = renderWithProviders(
      <NodeDetailsPanel
        org={null}
        cluster={null}
        isAdmin
        onClose={vi.fn()}
        onSelectMember={vi.fn()}
      />,
    );
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveAttribute('aria-hidden', 'true');
    // No org/cluster body content is rendered.
    expect(screen.queryByRole('button', { name: 'Close details' })).not.toBeInTheDocument();
    expect(aside?.textContent).toBe('');
  });
});
