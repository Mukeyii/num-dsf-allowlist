import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ExpiryWarningBanner } from '../ExpiryWarningBanner';
import { useCanvasStore } from '../../../stores/canvas.store';

let expiring: { id: string; subject: string; valid_until: string }[] = [];

vi.mock('../../../api/entities.api', () => ({
  api: () => ({
    getExpiringCerts: () => Promise.resolve({ data: { data: expiring } }),
  }),
}));

// Far-future / near dates so daysUntil() is deterministic relative to "now".
const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

describe('ExpiryWarningBanner', () => {
  beforeEach(() => {
    useCanvasStore.setState({ activeInstanceId: 'i1' });
  });

  it('renders nothing when no certificates are expiring', () => {
    expiring = [];
    const { container } = renderWithProviders(<ExpiryWarningBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns when certificates are expiring soon', async () => {
    expiring = [{ id: 'c1', subject: 'CN=ukm.de', valid_until: soon }];
    renderWithProviders(<ExpiryWarningBanner />);
    await waitFor(() => {
      expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
    });
    expect(screen.getByText('CN=ukm.de')).toBeInTheDocument();
  });
});
