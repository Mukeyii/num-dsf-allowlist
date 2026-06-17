/**
 * MarketplaceCard.test.tsx — the presentational process card: links to the
 * detail page and surfaces status, verified mark, roles, DSF version, advisory.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { MarketplaceCard } from '../MarketplaceCard';
import type { MarketplaceEntry } from '../../../api/marketplace.api';

function makeEntry(over: Partial<MarketplaceEntry> = {}): MarketplaceEntry {
  return {
    id: 'e1',
    slug: 'owner-repo',
    gitUrl: 'https://github.com/owner/repo',
    name: 'Data Transfer Process',
    description: 'Moves data between sites.',
    status: 'APPROVED',
    latestReleaseTag: 'v1.2.0',
    lastCommitAt: null,
    stars: 7,
    license: 'MIT',
    topics: ['fhir', 'bpmn'],
    forks: 1,
    openIssues: 0,
    archived: false,
    homepage: null,
    language: 'Java',
    processIdentifiers: ['dsf.dataTransfer'],
    dsfVersionMin: '1.5',
    requiredRoles: ['DIC', 'HRP'],
    messageNames: ['startDataTransfer'],
    artifactUrl: null,
    metadataSource: 'MANUAL',
    verified: false,
    advisoryText: null,
    advisorySeverity: null,
    supersededBy: null,
    licenseOk: true,
    stale: false,
    syncAt: null,
    syncError: null,
    ...over,
  };
}

describe('MarketplaceCard', () => {
  it('renders the process name and status pill', () => {
    renderWithProviders(<MarketplaceCard entry={makeEntry()} />);
    expect(screen.getByText('Data Transfer Process')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('links to the detail page by slug', () => {
    renderWithProviders(<MarketplaceCard entry={makeEntry({ slug: 'owner-repo' })} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/marketplace/owner-repo');
  });

  it('shows role chips and the DSF version', () => {
    renderWithProviders(<MarketplaceCard entry={makeEntry()} />);
    expect(screen.getByText('DIC')).toBeInTheDocument();
    expect(screen.getByText('HRP')).toBeInTheDocument();
    expect(screen.getByText(/1\.5/)).toBeInTheDocument();
  });

  it('shows a verified mark when verified', () => {
    renderWithProviders(<MarketplaceCard entry={makeEntry({ verified: true })} />);
    expect(screen.getByLabelText(/verified/i)).toBeInTheDocument();
  });

  it('shows an advisory ribbon when a severity is set', () => {
    renderWithProviders(
      <MarketplaceCard entry={makeEntry({ advisorySeverity: 'CRITICAL', advisoryText: 'CVE' })} />,
    );
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });
});
