/**
 * FkLink.test.tsx — the FK link renders its label and value, and clicking the
 * value highlights the target entity in the canvas store.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useCanvasStore } from '../../../stores/canvas.store';
import { FkLink } from '../FkLink';

describe('FkLink', () => {
  it('renders the label and value', () => {
    renderWithProviders(<FkLink label="Organization" targetEntity="organization" value="ukm.de" />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('ukm.de')).toBeInTheDocument();
  });

  it('highlights the target entity when the value is clicked', async () => {
    renderWithProviders(<FkLink label="Endpoint" targetEntity="endpoints" value="ep.ukm.de" />);
    await userEvent.click(screen.getByText('ep.ukm.de'));
    expect(useCanvasStore.getState().highlightedEntity).toBe('endpoints');
  });
});
