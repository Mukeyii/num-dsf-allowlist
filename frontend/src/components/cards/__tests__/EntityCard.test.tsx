/**
 * EntityCard.test.tsx — the shared card wrapper renders its title and children
 * and fires onAdd when the add control is clicked.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { EntityCard } from '../EntityCard';

describe('EntityCard', () => {
  it('renders the title and children', () => {
    renderWithProviders(
      <EntityCard id="org" title="Organization" borderColor="#b01e66" icon="business">
        <p>card body</p>
      </EntityCard>,
    );
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('card body')).toBeInTheDocument();
  });

  it('fires onAdd when the add button is clicked', async () => {
    const onAdd = vi.fn();
    renderWithProviders(
      <EntityCard
        id="c"
        title="Contacts"
        borderColor="#000"
        icon="x"
        onAdd={onAdd}
        addLabel="+ Add"
      >
        <span />
      </EntityCard>,
    );
    await userEvent.click(screen.getByText('+ Add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
