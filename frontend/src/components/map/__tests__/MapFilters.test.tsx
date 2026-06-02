import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { MapFilters, type MapFilterState } from '../MapFilters';

function makeState(overrides: Partial<MapFilterState> = {}): MapFilterState {
  return {
    query: '',
    activeMode: 'all',
    certStatuses: new Set(),
    ...overrides,
  };
}

describe('MapFilters', () => {
  it('renders the search placeholder, mode buttons and status chips', () => {
    renderWithProviders(
      <MapFilters
        state={makeState()}
        onChange={vi.fn()}
        totalCount={10}
        visibleCount={4}
        cityCount={3}
        showAllEdges={false}
        onToggleShowAllEdges={vi.fn()}
        verbundPills={<div>pills-slot</div>}
      />,
    );
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(screen.getByText('pills-slot')).toBeInTheDocument();
    expect(screen.getByText(/Showing 4 of 10 sites in 3 cities/)).toBeInTheDocument();
  });

  it('toggles a cert status on chip click', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MapFilters
        state={makeState()}
        onChange={onChange}
        totalCount={10}
        visibleCount={4}
        cityCount={3}
        showAllEdges={false}
        onToggleShowAllEdges={vi.fn()}
        verbundPills={null}
      />,
    );
    await userEvent.click(screen.getByText('Valid'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as MapFilterState;
    expect(next.certStatuses.has('VALID')).toBe(true);
  });

  it('invokes onToggleShowAllEdges on the connections button', async () => {
    const onToggleShowAllEdges = vi.fn();
    renderWithProviders(
      <MapFilters
        state={makeState()}
        onChange={vi.fn()}
        totalCount={10}
        visibleCount={4}
        cityCount={3}
        showAllEdges={false}
        onToggleShowAllEdges={onToggleShowAllEdges}
        verbundPills={null}
      />,
    );
    await userEvent.click(screen.getByText('Show all connections'));
    expect(onToggleShowAllEdges).toHaveBeenCalledTimes(1);
  });
});
