import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { GeoMap } from '../GeoMap';
import { GermanyOutline } from '../GermanyOutline';
import { derivePeerEdges } from '../../../lib/peerEdges';
import type { MapOrganization } from '../../../api/network.api';

// Two orgs in *different* known cities (Berlin / Hamburg) so each renders as
// its own pin rather than collapsing into a single-city cluster. Both share a
// parent_organization, so derivePeerEdges yields exactly one peer edge.
const VERBUND = 'num-testverband.example.de';

function org(id: string, name: string, city: string): MapOrganization {
  return {
    identifier: id,
    name,
    active: true,
    city,
    country_code: 'DE',
    cert_status: 'VALID',
    endpoints: [],
    memberships: [{ parent_organization: VERBUND, roles: ['DIC'] }],
  };
}

const orgs: MapOrganization[] = [
  org('ukm.de', 'Uni Klinikum Muenster', 'Berlin'),
  org('uksh.de', 'Uni Klinikum Hamburg', 'Hamburg'),
];

const edges = derivePeerEdges(orgs);

function renderMap(opts: { showAllEdges?: boolean; onSelect?: () => void } = {}) {
  const onSelect = opts.onSelect ?? vi.fn();
  const view = renderWithProviders(
    <GeoMap
      organizations={orgs}
      allOrganizations={orgs}
      selectedId={null}
      onSelect={onSelect}
      edges={edges}
      activeVerbunds={new Set()}
      showAllEdges={opts.showAllEdges ?? false}
    />,
  );
  return { onSelect, ...view };
}

function bezierCount(container: HTMLElement): number {
  return Array.from(container.querySelectorAll('path')).filter((p) =>
    (p.getAttribute('d') ?? '').includes('Q'),
  ).length;
}

describe('GeoMap', () => {
  it('renders one pin per seeded org node (distinct cities)', () => {
    renderMap();
    // Each GeoMapPin exposes role="button" with aria-label = org name.
    expect(screen.getByRole('button', { name: 'Uni Klinikum Muenster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uni Klinikum Hamburg' })).toBeInTheDocument();
    // Exactly the two pins — no extra cluster/button slipped in.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('fires onSelect with the org identifier when a pin is clicked', () => {
    const { onSelect } = renderMap();
    fireEvent.click(screen.getByRole('button', { name: 'Uni Klinikum Muenster' }));
    expect(onSelect).toHaveBeenCalledWith('ukm.de');
  });

  it('derives exactly one peer edge for two orgs sharing a verbund', () => {
    // Sanity-check the fixture so the edge-render assertion below is meaningful.
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: 'ukm.de', to: 'uksh.de', verbund: VERBUND });
  });

  it('renders an edge path per seeded relation when showAllEdges is on', () => {
    const { container } = renderMap({ showAllEdges: true });
    // The edge layer draws a quadratic-bezier <path d="M ... Q ... ">.
    expect(bezierCount(container)).toBe(1);
  });

  it('draws no edge path when showAllEdges is off and nothing is selected', () => {
    const { container } = renderMap({ showAllEdges: false });
    expect(bezierCount(container)).toBe(0);
  });

  it('renders the empty-state message and no SVG when there are no orgs', () => {
    const { container } = renderWithProviders(
      <GeoMap
        organizations={[]}
        allOrganizations={[]}
        selectedId={null}
        onSelect={vi.fn()}
        edges={[]}
        activeVerbunds={new Set()}
        showAllEdges={false}
      />,
    );
    expect(
      screen.getByText('No approved organizations in the allow list yet.'),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('GermanyOutline', () => {
  it('renders one SVG path per federal-state silhouette', () => {
    const { container } = renderWithProviders(
      <svg>
        <GermanyOutline />
      </svg>,
    );
    const paths = container.querySelectorAll('path');
    // 16 German federal states, each a single <path>.
    expect(paths.length).toBe(16);
    // Each path carries real geometry data.
    paths.forEach((p) => {
      expect(p.getAttribute('d')).toBeTruthy();
    });
  });
});
