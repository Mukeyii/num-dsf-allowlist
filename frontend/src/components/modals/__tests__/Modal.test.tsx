import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <Modal open={false} onClose={() => {}} title="My Title">
        <p>child content</p>
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('My Title')).not.toBeInTheDocument();
  });

  it('renders the title and children when open', () => {
    renderWithProviders(
      <Modal open onClose={() => {}} title="My Title">
        <p>child content</p>
      </Modal>,
    );
    expect(screen.getByRole('heading', { name: 'My Title' })).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open onClose={onClose} title="My Title">
        <p>child content</p>
      </Modal>,
    );
    // Localized aria-label ("Close"); query by role to stay robust.
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
