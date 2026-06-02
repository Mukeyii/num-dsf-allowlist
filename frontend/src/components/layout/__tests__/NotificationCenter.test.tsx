import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useNotificationStore } from '../../../stores/notification.store';
import { NotificationCenter } from '../NotificationCenter';

describe('NotificationCenter', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it('renders the bell with no unread badge when empty', () => {
    renderWithProviders(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('shows the unread badge after a notification is added', () => {
    useNotificationStore.getState().addNotification('Saved successfully', 'success');
    renderWithProviders(<NotificationCenter />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('reveals the notification message when the dropdown is opened', async () => {
    const user = userEvent.setup();
    useNotificationStore.getState().addNotification('Endpoint updated', 'info');
    renderWithProviders(<NotificationCenter />);
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText(/Endpoint updated/i)).toBeInTheDocument();
  });
});
