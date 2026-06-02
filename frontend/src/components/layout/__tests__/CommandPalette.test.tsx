/**
 * CommandPalette.test.tsx — the palette holds its open state internally and
 * opens on Ctrl+K (a window keydown listener). Data hooks are mocked. We assert
 * it renders nothing while closed, then dispatch Ctrl+K and assert the search
 * placeholder appears.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useInstance', () => ({
  useInstances: () => ({ data: [] }),
}));
vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: { isAdmin: false } }),
}));

import { CommandPalette } from '../CommandPalette';

describe('CommandPalette', () => {
  it('renders nothing while closed', () => {
    const { container } = renderWithProviders(<CommandPalette />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on Ctrl+K and shows the command placeholder', () => {
    renderWithProviders(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  });
});
