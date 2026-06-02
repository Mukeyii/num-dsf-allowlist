import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../api/entities.api', () => ({
  api: () => ({ createInstance: vi.fn() }),
}));

import { InstanceCreateModal } from '../InstanceCreateModal';

describe('InstanceCreateModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <InstanceCreateModal open={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and the create button when open', () => {
    renderWithProviders(<InstanceCreateModal open onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: /add new instance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create instance/i })).toBeInTheDocument();
  });
});
