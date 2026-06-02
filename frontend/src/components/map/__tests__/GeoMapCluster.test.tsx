import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { GeoMapCluster, clusterKeyOf } from '../GeoMapCluster';
import type { MapOrganization, MapClusterGroup } from '../../../api/network.api';

function member(id: string, status: MapOrganization['cert_status']): MapOrganization {
  return {
    identifier: id,
    name: id,
    active: true,
    city: 'Berlin',
    country_code: 'DE',
    cert_status: status,
    endpoints: [],
    memberships: [],
  };
}

const group: MapClusterGroup = {
  city: 'Berlin',
  country_code: 'DE',
  members: [member('a.de', 'VALID'), member('b.de', 'EXPIRED')],
  worstStatus: 'EXPIRED',
};

describe('GeoMapCluster', () => {
  it('renders city initials and the full member count badge', () => {
    renderWithProviders(
      <svg>
        <GeoMapCluster
          group={group}
          x={200}
          y={200}
          isHovered={false}
          isSelected={false}
          matchedCount={2}
          onSelect={vi.fn()}
          onHover={vi.fn()}
        />
      </svg>,
    );
    expect(screen.getByText('BE')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows a "visible/total" badge when filters trim members', () => {
    renderWithProviders(
      <svg>
        <GeoMapCluster
          group={group}
          x={200}
          y={200}
          isHovered={false}
          isSelected={false}
          matchedCount={1}
          onSelect={vi.fn()}
          onHover={vi.fn()}
        />
      </svg>,
    );
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('fires onSelect with the cluster key on click', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <svg>
        <GeoMapCluster
          group={group}
          x={200}
          y={200}
          isHovered={false}
          isSelected={false}
          matchedCount={2}
          onSelect={onSelect}
          onHover={vi.fn()}
        />
      </svg>,
    );
    fireEvent.click(screen.getByText('BE'));
    expect(onSelect).toHaveBeenCalledWith(clusterKeyOf(group));
  });
});
