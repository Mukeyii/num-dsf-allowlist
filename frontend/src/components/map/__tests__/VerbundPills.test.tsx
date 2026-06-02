import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { VerbundPills } from '../VerbundPills';

describe('VerbundPills', () => {
  it('renders a pill per verbund with its count and label', () => {
    renderWithProviders(
      <VerbundPills
        counts={new Map([['mii-testverband.example.de', 3]])}
        active={new Set()}
        onToggle={vi.fn()}
      />,
    );
    // verbundLabel maps the known FQDN to "MII"; count is rendered as "(3)"
    expect(screen.getByText(/MII/)).toBeInTheDocument();
    expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
  });

  it('calls onToggle with the parent_organization on click', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <VerbundPills
        counts={new Map([['mii-testverband.example.de', 3]])}
        active={new Set()}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('mii-testverband.example.de');
  });

  it('renders nothing when there are no verbund counts', () => {
    const { container } = renderWithProviders(
      <VerbundPills counts={new Map()} active={new Set()} onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
