/**
 * approved-bundle-mail.test.ts — render tests for the post-approval
 * notification template. No DB or network — pure unit tests.
 */
import {
  renderApprovedBundleMail,
  type ApprovedBundleMailContext,
} from '../services/mail-templates/approved-bundle-mail';

const baseCtx: ApprovedBundleMailContext = {
  language: 'en',
  endpointIdentifier: 'dsf-fhir-test.example.de',
  environment: 'TEST',
  portalUrl: 'https://allowlist.example.de',
  bundleVersionNumber: 42,
  contentHash: 'a'.repeat(64),
  signatureKid: '0123456789abcdef',
  changes: { addedOrgs: 3, removedOrgs: 1, changedOrgs: 2 },
  downloadUrl: 'https://allowlist.example.de/api/v1/instances/inst-1/download/full-bundle',
  verifyUrl: 'https://allowlist.example.de/app/admin/bundle-versions',
  supportEmail: 'dsf-support@example.de',
};

describe('renderApprovedBundleMail', () => {
  it('renders English subject with environment + version + endpoint', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en' });
    expect(m.subject).toContain('TEST');
    expect(m.subject).toContain('v42');
    expect(m.subject).toContain('dsf-fhir-test.example.de');
  });

  it('renders German subject with the localized phrasing', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'de' });
    expect(m.subject).toMatch(/Neue Bundle-Version/);
  });

  it('includes content hash, download URL and verify URL in both text and html', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en' });
    expect(m.text).toContain(baseCtx.contentHash);
    expect(m.text).toContain(baseCtx.downloadUrl);
    expect(m.text).toContain(baseCtx.verifyUrl);
    expect(m.html).toContain(baseCtx.contentHash);
    expect(m.html).toContain(baseCtx.downloadUrl);
    expect(m.html).toContain(baseCtx.verifyUrl);
  });

  it('renders an actionable changes line', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en' });
    expect(m.text).toContain('3 added');
    expect(m.text).toContain('1 removed');
    expect(m.text).toContain('2 updated');
  });

  it('greets without name when recipientName is missing or empty', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en', recipientName: null });
    expect(m.text).toContain('Hello,');
    const m2 = renderApprovedBundleMail({ ...baseCtx, language: 'en', recipientName: undefined });
    expect(m2.text).toContain('Hello,');
  });

  it('greets the recipient by name when provided', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en', recipientName: 'Alice' });
    expect(m.text).toContain('Hello Alice,');
    const m2 = renderApprovedBundleMail({ ...baseCtx, language: 'de', recipientName: 'Bob' });
    expect(m2.text).toContain('Hallo Bob,');
  });

  it('omits the signature-kid row when no kid is supplied', () => {
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'en', signatureKid: undefined });
    expect(m.text).not.toContain('Signature key id');
    expect(m.html).not.toContain('Signature key id');
  });

  it('HTML-escapes untrusted fields to neutralise injection attempts', () => {
    const m = renderApprovedBundleMail({
      ...baseCtx,
      language: 'en',
      recipientName: 'Mallory<script>alert(1)</script>',
      endpointIdentifier: 'evil.com" onmouseover="alert(1)',
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('Mallory&lt;script&gt;');
    expect(m.html).not.toMatch(/onmouseover="alert/);
  });

  it('falls back to English when an unsupported language is passed in', () => {
    // @ts-expect-error — intentionally bad locale to verify the runtime fallback
    const m = renderApprovedBundleMail({ ...baseCtx, language: 'fr' });
    expect(m.subject).toMatch(/New bundle/);
  });
});
