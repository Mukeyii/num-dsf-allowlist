import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => ({ data: [], isLoading: false }),
}));
// BundlePreview pulls extra API state irrelevant to this render test.
vi.mock('../BundlePreview', () => ({ BundlePreview: () => null }));
vi.mock('../../../api/entities.api', () => ({
  api: () => ({ downloadIpList: vi.fn() }),
  downloadFullAllowListBundle: vi.fn(),
}));

import { DownloadModal } from '../DownloadModal';

describe('DownloadModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <DownloadModal open={false} onClose={() => {}} instanceId="i1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and the disclaimer gate when open', () => {
    renderWithProviders(<DownloadModal open onClose={() => {}} instanceId="i1" />);
    expect(screen.getByRole('heading', { name: /download allow list/i })).toBeInTheDocument();
    // Download buttons start disabled behind the acknowledgment gate.
    expect(screen.getByTestId('download-bundle-btn')).toBeDisabled();
  });
});
