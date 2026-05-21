/**
 * approved-bundle-mail.ts – Notification email sent to a site contact
 * after the federation allow-list reaches a new APPROVED version.
 *
 * Renders both text and HTML variants. Language preference comes from
 * the contact record (defaults to EN).
 */

export interface ApprovedBundleMailContext {
  language: 'en' | 'de';
  recipientName?: string | null;
  endpointIdentifier: string;        // e.g. dsf-fhir-test.uni-muenster.de
  environment: 'TEST' | 'PRODUCTION';
  portalUrl: string;                 // e.g. https://allowlist.imi-muenster.de
  bundleVersionNumber: number;       // bundle_versions.version_number
  contentHash: string;               // sha-256 of bundle JSON
  signatureKid?: string;             // RS256 kid for offline verification
  changes: {
    addedOrgs: number;
    removedOrgs: number;
    changedOrgs: number;
  };
  downloadUrl: string;               // direct download URL
  verifyUrl: string;                 // /app/admin/bundle-versions/<id>
  supportEmail: string;              // e.g. dsf-support@imi-muenster.de
}

interface LocaleStrings {
  subject: (ctx: ApprovedBundleMailContext) => string;
  greeting: (name?: string | null) => string;
  intro: (ctx: ApprovedBundleMailContext) => string;
  changesHeading: string;
  changesLine: (c: ApprovedBundleMailContext['changes']) => string;
  downloadHeading: string;
  verifyHeading: string;
  verifyBody: string;
  contentHashLabel: string;
  signatureKidLabel: string;
  portalLink: string;
  supportLine: (email: string) => string;
  footer: (env: string) => string;
}

const STR: Record<'en' | 'de', LocaleStrings> = {
  en: {
    subject: (ctx) =>
      `[DSF Allow List · ${ctx.environment}] New bundle v${ctx.bundleVersionNumber} available for ${ctx.endpointIdentifier}`,
    greeting: (name) => (name ? `Hello ${name},` : 'Hello,'),
    intro: (ctx) =>
      `A new DSF Allow-List bundle (version ${ctx.bundleVersionNumber}) was approved for the federation containing your endpoint ${ctx.endpointIdentifier}.`,
    changesHeading: 'Changes against the previous version',
    changesLine: (c) =>
      `${c.addedOrgs} added · ${c.removedOrgs} removed · ${c.changedOrgs} updated`,
    downloadHeading: 'Download',
    verifyHeading: 'Verify before deployment',
    verifyBody:
      'The bundle is RS256-signed. Re-fetch the public key from the portal and verify the JWT-style signature shipped with the bundle before installing it in your DSF environment. The receiving site is solely responsible for verifying content, signature, and provenance.',
    contentHashLabel: 'Content hash (SHA-256)',
    signatureKidLabel: 'Signature key id',
    portalLink: 'Open the Allow-List portal',
    supportLine: (email) => `Questions or issues? Contact the operator: ${email}`,
    footer: (env) =>
      `This message was sent by the DSF Allow-List portal (${env} environment). Do not reply — this address is unattended.`,
  },
  de: {
    subject: (ctx) =>
      `[DSF Allow List · ${ctx.environment}] Neue Bundle-Version v${ctx.bundleVersionNumber} für ${ctx.endpointIdentifier}`,
    greeting: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    intro: (ctx) =>
      `Eine neue DSF-Allow-List-Bundle-Version (v${ctx.bundleVersionNumber}) wurde für die Föderation freigegeben, zu der Ihr Endpoint ${ctx.endpointIdentifier} gehört.`,
    changesHeading: 'Änderungen gegenüber der Vorversion',
    changesLine: (c) =>
      `${c.addedOrgs} hinzugefügt · ${c.removedOrgs} entfernt · ${c.changedOrgs} aktualisiert`,
    downloadHeading: 'Download',
    verifyHeading: 'Vor dem Deployment prüfen',
    verifyBody:
      'Das Bundle ist RS256-signiert. Holen Sie den öffentlichen Schlüssel erneut aus dem Portal und verifizieren Sie die JWT-Signatur, bevor Sie das Bundle in Ihre DSF-Umgebung übernehmen. Die Verantwortung für die Prüfung von Inhalt, Signatur und Provenienz liegt beim empfangenden Standort.',
    contentHashLabel: 'Content-Hash (SHA-256)',
    signatureKidLabel: 'Signatur-Schlüssel-ID',
    portalLink: 'Allow-List-Portal öffnen',
    supportLine: (email) =>
      `Fragen oder Probleme? Wenden Sie sich an den Betreiber: ${email}`,
    footer: (env) =>
      `Diese Nachricht wurde vom DSF-Allow-List-Portal (Umgebung ${env}) versandt. Bitte nicht antworten — diese Adresse wird nicht überwacht.`,
  },
};

// Tiny HTML-escape so untrusted strings (recipientName, endpointIdentifier,
// support email) cannot inject markup into the HTML body. Plain text body
// does not need this.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

export function renderApprovedBundleMail(ctx: ApprovedBundleMailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const t = STR[ctx.language] ?? STR.en;
  const subject = t.subject(ctx);

  const text = [
    t.greeting(ctx.recipientName ?? null),
    '',
    t.intro(ctx),
    '',
    t.changesHeading + ':',
    '  ' + t.changesLine(ctx.changes),
    '',
    t.downloadHeading + ': ' + ctx.downloadUrl,
    t.verifyHeading + ': ' + ctx.verifyUrl,
    '',
    t.contentHashLabel + ': ' + ctx.contentHash,
    ctx.signatureKid ? t.signatureKidLabel + ': ' + ctx.signatureKid : '',
    '',
    t.verifyBody,
    '',
    t.supportLine(ctx.supportEmail),
    '',
    '— ' + t.footer(ctx.environment),
  ].filter(Boolean).join('\n');

  // Minimal HTML — no external CSS so mail clients don't strip it.
  const html = `<!DOCTYPE html>
<html lang="${ctx.language}">
<body style="font-family: -apple-system, system-ui, sans-serif; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>${esc(t.greeting(ctx.recipientName ?? null))}</p>
  <p>${esc(t.intro(ctx))}</p>
  <h3 style="color: #b01e66; margin-top: 24px;">${esc(t.changesHeading)}</h3>
  <p style="background: #fde3ef; padding: 12px; border-radius: 8px; font-family: ui-monospace, monospace;">
    ${esc(t.changesLine(ctx.changes))}
  </p>
  <h3 style="color: #b01e66; margin-top: 24px;">${esc(t.downloadHeading)}</h3>
  <p>
    <a href="${esc(ctx.downloadUrl)}" style="display:inline-block; background:#b01e66; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none;">
      v${ctx.bundleVersionNumber} &#8595;
    </a>
  </p>
  <h3 style="color: #b01e66; margin-top: 24px;">${esc(t.verifyHeading)}</h3>
  <p>${esc(t.verifyBody)}</p>
  <p><a href="${esc(ctx.verifyUrl)}">${esc(ctx.verifyUrl)}</a></p>
  <table style="font-family: ui-monospace, monospace; font-size: 12px; border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0;"><strong>${esc(t.contentHashLabel)}</strong></td><td>${esc(ctx.contentHash)}</td></tr>
    ${ctx.signatureKid ? `<tr><td style="padding: 4px 12px 4px 0;"><strong>${esc(t.signatureKidLabel)}</strong></td><td>${esc(ctx.signatureKid)}</td></tr>` : ''}
  </table>
  <p style="margin-top: 24px;">
    <a href="${esc(ctx.portalUrl)}">${esc(t.portalLink)}</a>
  </p>
  <p style="color: #64748b; font-size: 12px;">${esc(t.supportLine(ctx.supportEmail))}</p>
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e8eaf0;" />
  <p style="color: #9b9fad; font-size: 11px;">${esc(t.footer(ctx.environment))}</p>
</body>
</html>`;

  return { subject, text, html };
}
