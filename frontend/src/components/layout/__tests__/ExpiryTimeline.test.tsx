/**
 * ExpiryTimeline.test.tsx — segment-state coverage for the certificate expiry
 * timeline. The component reads useCertificates(instanceId), which calls
 * api(instanceId).getCertificates(); we mock entities.api so daysUntil() runs
 * against real "now" with dates built relative to it. Wide day margins keep the
 * green/amber/red band selection deterministic (boundaries are 30 and 90 days).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ExpiryTimeline } from '../ExpiryTimeline';

interface CertFixture {
  id: string;
  subject: string;
  valid_until: string;
}

let certs: CertFixture[] = [];

vi.mock('../../../api/entities.api', () => ({
  api: () => ({
    getCertificates: () => Promise.resolve({ data: { data: certs } }),
  }),
}));

// ISO date (YYYY-MM-DD) N days from now. Wide margins avoid the 30/90-day
// band boundaries so the chosen colour never flips with time-of-day rounding.
const isoDaysFromNow = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Normalise a CSS colour through jsdom's CSSOM so a hex literal compares equal
 * regardless of whether jsdom stores it as hex or rgb(). Returns the canonical
 * string the DOM serialises the input to.
 */
const canonicalColor = (value: string): string => {
  const probe = document.createElement('span');
  probe.style.color = value;
  return probe.style.color;
};

// The timeline row is the nearest ancestor with position:relative; the dot and
// the day/EXPIRED badge both live inside it. Finding the row from the subject
// text scopes the colour assertions to that one certificate.
const rowFor = (subject: HTMLElement): HTMLElement => {
  const row = subject.closest('div[style*="position: relative"]');
  if (!row) throw new Error('timeline row not found for subject');
  return row as HTMLElement;
};

const dotOf = (row: HTMLElement): HTMLElement => {
  const dot = row.querySelector('div[style*="border-radius: 50%"]');
  if (!dot) throw new Error('timeline dot not found in row');
  return dot as HTMLElement;
};

const GREEN = '#22c55e';
const AMBER = '#f5a623';
const RED = '#ef4444';

describe('ExpiryTimeline', () => {
  beforeEach(() => {
    certs = [];
  });

  it('renders nothing when there are no certificates', () => {
    certs = [];
    const { container } = renderWithProviders(<ExpiryTimeline instanceId="i1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no instance is selected (query disabled)', () => {
    certs = [{ id: 'c1', subject: 'CN=ukm.de', valid_until: isoDaysFromNow(200) }];
    const { container } = renderWithProviders(<ExpiryTimeline instanceId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a far-future certificate as valid (green dot, day-count badge)', async () => {
    certs = [{ id: 'c1', subject: 'CN=valid.ukm.de', valid_until: isoDaysFromNow(200) }];
    renderWithProviders(<ExpiryTimeline instanceId="i1" />);

    const row = rowFor(await screen.findByText('CN=valid.ukm.de', undefined, { timeout: 4000 }));

    // Day-count badge, not EXPIRED, for a still-valid certificate.
    const badge = within(row).getByText(/^\d+d$/);
    expect(badge.style.color).toBe(canonicalColor(GREEN));
    expect(dotOf(row).style.background).toBe(canonicalColor(GREEN));
  });

  it('marks a certificate inside the 90-day window as expiring soon (amber)', async () => {
    certs = [{ id: 'c2', subject: 'CN=soon.ukm.de', valid_until: isoDaysFromNow(60) }];
    renderWithProviders(<ExpiryTimeline instanceId="i1" />);

    const row = rowFor(await screen.findByText('CN=soon.ukm.de', undefined, { timeout: 4000 }));

    const badge = within(row).getByText(/^\d+d$/);
    expect(badge.style.color).toBe(canonicalColor(AMBER));
    expect(dotOf(row).style.background).toBe(canonicalColor(AMBER));
  });

  it('marks an already-past certificate as expired (red dot, EXPIRED badge)', async () => {
    certs = [{ id: 'c3', subject: 'CN=old.ukm.de', valid_until: isoDaysFromNow(-10) }];
    renderWithProviders(<ExpiryTimeline instanceId="i1" />);

    const row = rowFor(await screen.findByText('CN=old.ukm.de', undefined, { timeout: 4000 }));

    const badge = within(row).getByText('EXPIRED');
    expect(badge.style.color).toBe(canonicalColor(RED));
    expect(dotOf(row).style.background).toBe(canonicalColor(RED));
  });

  it('renders the section header and sorts certificates by ascending expiry', async () => {
    certs = [
      { id: 'far', subject: 'CN=far.ukm.de', valid_until: isoDaysFromNow(200) },
      { id: 'near', subject: 'CN=near.ukm.de', valid_until: isoDaysFromNow(5) },
    ];
    renderWithProviders(<ExpiryTimeline instanceId="i1" />);

    expect(
      await screen.findByText('Certificate Timeline', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();

    const subjects = screen.getAllByText(/^CN=(near|far)\.ukm\.de$/).map((el) => el.textContent);
    // Earliest expiry first: the +5-day cert precedes the +200-day cert.
    expect(subjects).toEqual(['CN=near.ukm.de', 'CN=far.ukm.de']);
  });
});
