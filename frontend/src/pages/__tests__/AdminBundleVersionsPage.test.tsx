/**
 * AdminBundleVersionsPage.test.tsx — admin bundle-version history.
 * bundleVersionsApi.list is mocked with one version row; asserts the title and
 * the version number rendered from the mocked hook.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api/bundleVersions.api', () => ({
  bundleVersionsApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        data: [
          { id: 'v1', version_number: 7, created_at: '2026-05-01T00:00:00Z', triggered_by: 'APPROVAL', triggered_by_email: 'admin@example.com', content_hash: 'abc', notes: null, approval_request_id: null },
        ],
        meta: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    }),
    diff: vi.fn(),
    downloadUrl: (id: string) => `/download/${id}`,
  },
}));

import { AdminBundleVersionsPage } from '../AdminBundleVersionsPage';

describe('AdminBundleVersionsPage', () => {
  it('renders the title and a version row', async () => {
    renderWithProviders(<AdminBundleVersionsPage />);
    expect(screen.getByRole('heading', { name: 'Bundle versions' })).toBeInTheDocument();
    expect(await screen.findByText('v7')).toBeInTheDocument();
  });
});
