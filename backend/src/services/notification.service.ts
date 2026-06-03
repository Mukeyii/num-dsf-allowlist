/**
 * notification.service.ts – Email notifications for approval workflow
 * Dependencies: nodemailer, .env (SMTP_*, MAIL_FROM, DSF_ENVIRONMENT)
 *
 * Functions:
 *   sendAdminNewRequestEmail    – notify admins of a new approval request
 *   sendAdminApprovalResultEmail – notify admins of approve/reject outcome
 *   sendSiteApprovalResultEmail  – notify site contacts of approve/reject outcome
 */
import nodemailer from 'nodemailer';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const IS_TEST = process.env.NODE_ENV === 'test';

const transporter = nodemailer.createTransport({
  host: IS_TEST ? 'localhost' : process.env.SMTP_HOST || 'mail',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM = process.env.MAIL_FROM || 'noreply@dsf-allowlist.local';
const ENV = process.env.DSF_ENVIRONMENT || 'TEST';

const BRAND = '#6c63ff';
const COLOR_APPROVED = '#22c55e';
const COLOR_REJECTED = '#ef4444';

function statusBadge(status: 'APPROVED' | 'REJECTED'): string {
  const color = status === 'APPROVED' ? COLOR_APPROVED : COLOR_REJECTED;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;background:${color};color:#fff;font-weight:bold;font-size:13px;">${status}</span>`;
}

function baseHtml(title: string, body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;">
      <h2 style="color:${BRAND};margin-bottom:4px;">DSF Allow List – ${ENV}</h2>
      <h3 style="margin-top:0;color:#333;">${title}</h3>
      ${body}
      <p style="color:#9b9fad;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
        This is an automated message from the DSF Management Portal.
      </p>
    </div>
  `;
}

export async function sendAdminNewRequestEmail(
  adminEmails: string[],
  orgName: string,
  orgIdentifier: string,
  submittedBy: string,
  requestId: string,
): Promise<void> {
  if (adminEmails.length === 0 || IS_TEST) return;

  const subject = `[DSF Allow List – ${ENV}] New approval request from ${orgName}`;

  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `New approval request submitted.`,
    ``,
    `Organization : ${orgName} (${orgIdentifier})`,
    `Submitted by : ${submittedBy}`,
    `Request ID   : ${requestId}`,
    ``,
    `Please log in to the portal to review this request.`,
  ].join('\n');

  const html = baseHtml(
    'New Approval Request',
    `
    <p>A new approval request has been submitted and requires your review.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Organization</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(orgName)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Identifier</td>
          <td style="padding:6px 0;">${esc(orgIdentifier)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Submitted by</td>
          <td style="padding:6px 0;">${esc(submittedBy)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Request ID</td>
          <td style="padding:6px 0;font-family:monospace;font-size:12px;">${esc(requestId)}</td></tr>
    </table>
    <p style="margin-top:20px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/admin"
         style="display:inline-block;padding:10px 20px;background:${BRAND};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Review in Portal
      </a>
    </p>
  `,
  );

  await transporter.sendMail({ from: FROM, to: adminEmails.join(','), subject, text, html });
}

export async function sendAdminApprovalResultEmail(
  adminEmails: string[],
  orgName: string,
  orgIdentifier: string,
  status: 'APPROVED' | 'REJECTED',
  resolvedBy: string,
  comment: string | null,
): Promise<void> {
  if (adminEmails.length === 0 || IS_TEST) return;

  const subject = `[DSF Allow List – ${ENV}] Request ${status.toLowerCase()} – ${orgName}`;

  const commentLine = comment ? `\nComment      : ${comment}` : '';
  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `An approval request has been ${status.toLowerCase()}.`,
    ``,
    `Organization : ${orgName} (${orgIdentifier})`,
    `Status       : ${status}`,
    `Resolved by  : ${resolvedBy}`,
    commentLine,
  ]
    .filter((line) => line !== '')
    .join('\n');

  const commentHtml = comment
    ? `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Comment</td>
           <td style="padding:6px 0;">${esc(comment)}</td></tr>`
    : '';

  const html = baseHtml(
    `Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
    `
    <p>An approval request has been resolved.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Organization</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(orgName)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Identifier</td>
          <td style="padding:6px 0;">${esc(orgIdentifier)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Status</td>
          <td style="padding:6px 0;">${statusBadge(status)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Resolved by</td>
          <td style="padding:6px 0;">${esc(resolvedBy)}</td></tr>
      ${commentHtml}
    </table>
  `,
  );

  await transporter.sendMail({ from: FROM, to: adminEmails.join(','), subject, text, html });
}

export async function sendAdminFirstApprovalEmail(
  adminEmails: string[],
  orgName: string,
  orgId: string,
  firstApproverEmail: string,
  requestId: string,
): Promise<void> {
  if (adminEmails.length === 0 || IS_TEST) return;

  const days = parseInt(process.env.APPROVAL_SILENT_CONSENT_DAYS || '7', 10);
  const subject = `[DSF Allow List – ${ENV}] First approval recorded for ${orgName}`;

  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `${firstApproverEmail} has approved the request for ${orgName} (${orgId}).`,
    ``,
    `A second admin from a different site must approve OR reject within ${days} days.`,
    `If no rejection arrives in that window, the request will be auto-approved (Schweigen als Zustimmung).`,
    ``,
    `Request ID: ${requestId}`,
  ].join('\n');

  const html = baseHtml(
    'First Approval Recorded',
    `
    <p><strong>${esc(firstApproverEmail)}</strong> has approved the request for <strong>${esc(orgName)}</strong> (${esc(orgId)}).</p>
    <p>A second admin from a <strong>different site</strong> must approve OR reject within <strong>${days} days</strong>.</p>
    <p>If no rejection arrives in that window, the request will be automatically approved (<em>Schweigen als Zustimmung</em>).</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Organization</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(orgName)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Identifier</td>
          <td style="padding:6px 0;">${esc(orgId)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">First approved by</td>
          <td style="padding:6px 0;">${esc(firstApproverEmail)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Request ID</td>
          <td style="padding:6px 0;font-family:monospace;font-size:12px;">${esc(requestId)}</td></tr>
    </table>
    <p style="margin-top:20px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/admin"
         style="display:inline-block;padding:10px 20px;background:${BRAND};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Review in Portal
      </a>
    </p>
  `,
  );

  await transporter.sendMail({ from: FROM, to: adminEmails.join(','), subject, text, html });
}

export async function sendSiteApprovalResultEmail(
  contactEmails: string[],
  orgName: string,
  status: 'APPROVED' | 'REJECTED',
  comment: string | null,
): Promise<void> {
  if (contactEmails.length === 0 || IS_TEST) return;

  const subject = `[DSF Allow List – ${ENV}] Your request has been ${status.toLowerCase()} – ${orgName}`;

  const commentLine = comment ? `\n\nComment from the reviewer:\n${comment}` : '';
  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `Your approval request for ${orgName} has been ${status.toLowerCase()}.`,
    commentLine,
    ``,
    `If you have questions, please contact the GECKO team.`,
  ]
    .filter((s) => s !== '')
    .join('\n');

  const commentHtml = comment
    ? `<div style="margin-top:16px;padding:12px;background:#f8f8fb;border-left:4px solid #ddd;border-radius:4px;">
         <p style="margin:0 0 4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reviewer comment</p>
         <p style="margin:0;">${esc(comment)}</p>
       </div>`
    : '';

  const outcomeColor = status === 'APPROVED' ? COLOR_APPROVED : COLOR_REJECTED;
  const outcomeText =
    status === 'APPROVED'
      ? 'Congratulations – your DSF Allow List entry has been approved.'
      : 'Unfortunately, your DSF Allow List request was not approved at this time.';

  const html = baseHtml(
    `Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
    `
    <div style="padding:16px;border-radius:8px;border:2px solid ${outcomeColor};margin-bottom:20px;">
      <p style="margin:0;">${statusBadge(status)}&nbsp;&nbsp;${outcomeText}</p>
    </div>
    ${commentHtml}
    <p style="margin-top:20px;font-size:13px;color:#555;">
      If you have questions or wish to resubmit, please log in to the portal or contact the GECKO team.
    </p>
  `,
  );

  await transporter.sendMail({ from: FROM, to: contactEmails.join(','), subject, text, html });
}

/**
 * sendApprovedBundleNotification — the structured post-approval email for a
 * SITE contact (one recipient at a time so each gets their locale).
 *
 * The legacy sendSiteApprovalResultEmail above stays in place for REJECTED
 * paths (it carries the reviewer comment). For APPROVED we want the new
 * verification-focused template: bundle version, content hash, signature
 * kid, download + verify URLs, change counts vs the previous version.
 */
import {
  renderApprovedBundleMail,
  type ApprovedBundleMailContext,
} from './mail-templates/approved-bundle-mail';

export async function sendApprovedBundleNotification(
  recipient: { email: string; name?: string | null; language: 'en' | 'de' },
  context: Omit<ApprovedBundleMailContext, 'language' | 'recipientName'>,
): Promise<void> {
  if (IS_TEST) return;
  const { subject, text, html } = renderApprovedBundleMail({
    ...context,
    language: recipient.language,
    recipientName: recipient.name ?? null,
  });
  await transporter.sendMail({ from: FROM, to: recipient.email, subject, text, html });
}

export async function sendAdminPromotionRequestedEmail(
  recipientAdminEmails: string[],
  targetEmail: string,
  requestedBy: string,
  requestId: string,
): Promise<void> {
  if (recipientAdminEmails.length === 0 || IS_TEST) return;
  const subject = `[DSF Allow List – ${ENV}] Admin promotion request: ${targetEmail}`;
  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `${requestedBy} has requested to promote ${targetEmail} to IMI admin.`,
    ``,
    `Two admins from different sites must approve. Open the portal to review:`,
    `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/admin/promotions`,
    ``,
    `Request ID: ${requestId}`,
  ].join('\n');
  const html = baseHtml(
    'New Admin Promotion Request',
    `
    <p><strong>${esc(requestedBy)}</strong> has requested to promote <strong>${esc(targetEmail)}</strong> to IMI admin.</p>
    <p>Two admins from <strong>different sites</strong> must explicitly approve.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Target</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(targetEmail)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Requested by</td>
          <td style="padding:6px 0;">${esc(requestedBy)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Request ID</td>
          <td style="padding:6px 0;font-family:monospace;font-size:12px;">${esc(requestId)}</td></tr>
    </table>
    <p style="margin-top:20px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/admin/promotions"
         style="display:inline-block;padding:10px 20px;background:${BRAND};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Review in Portal
      </a>
    </p>
  `,
  );
  await transporter.sendMail({
    from: FROM,
    to: recipientAdminEmails.join(','),
    subject,
    text,
    html,
  });
}

export async function sendCertExpiryWarning(
  to: string,
  opts: {
    orgName: string;
    orgIdentifier: string;
    subject: string;
    daysLeft: number;
    validUntil: string;
  },
): Promise<void> {
  if (IS_TEST) return;

  const mailSubject = `[DSF Allow List – ${ENV}] Certificate expiring in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'} for ${opts.orgName}`;

  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `A certificate for ${opts.orgName} (${opts.orgIdentifier}) is about to expire.`,
    ``,
    `Certificate subject : ${opts.subject}`,
    `Valid until          : ${opts.validUntil}`,
    `Days remaining       : ${opts.daysLeft}`,
    ``,
    `Please renew it via the DSF Allow List portal before it expires.`,
  ].join('\n');

  const urgencyColor = opts.daysLeft <= 7 ? '#ef4444' : opts.daysLeft <= 30 ? '#f97316' : '#f59e0b';

  const html = baseHtml(
    'Certificate Expiry Warning',
    `
    <div style="padding:16px;border-radius:8px;border:2px solid ${urgencyColor};margin-bottom:20px;">
      <p style="margin:0;font-weight:bold;color:${urgencyColor};">
        Certificate expires in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}
      </p>
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Organization</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(opts.orgName)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Identifier</td>
          <td style="padding:6px 0;">${esc(opts.orgIdentifier)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Certificate subject</td>
          <td style="padding:6px 0;font-family:monospace;font-size:12px;">${esc(opts.subject)}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#666;">Valid until</td>
          <td style="padding:6px 0;">${esc(opts.validUntil)}</td></tr>
    </table>
    <p style="margin-top:20px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/app"
         style="display:inline-block;padding:10px 20px;background:${BRAND};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Renew in Portal
      </a>
    </p>
  `,
  );

  await transporter.sendMail({ from: FROM, to, subject: mailSubject, text, html });
}

export async function sendAdminPromotionResultEmail(
  recipients: string[],
  targetEmail: string,
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
  reason: string | null,
): Promise<void> {
  if (recipients.length === 0 || IS_TEST) return;
  const subject =
    status === 'APPROVED'
      ? `[DSF Allow List – ${ENV}] Admin promotion approved: ${targetEmail}`
      : status === 'REJECTED'
        ? `[DSF Allow List – ${ENV}] Admin promotion rejected: ${targetEmail}`
        : `[DSF Allow List – ${ENV}] Admin promotion cancelled: ${targetEmail}`;
  const reasonLine = reason ? `\n\nReason: ${reason}` : '';
  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `Promotion request for ${targetEmail} was ${status.toLowerCase()}.`,
    reasonLine,
  ]
    .filter(Boolean)
    .join('\n');
  const reasonHtml = reason
    ? `<div style="margin-top:16px;padding:12px;background:#f8f8fb;border-left:4px solid #ddd;border-radius:4px;">
         <p style="margin:0 0 4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
         <p style="margin:0;">${esc(reason)}</p>
       </div>`
    : '';
  const statusColor =
    status === 'APPROVED' ? COLOR_APPROVED : status === 'REJECTED' ? COLOR_REJECTED : '#9b9fad';
  const html = baseHtml(
    `Admin Promotion ${status.charAt(0) + status.slice(1).toLowerCase()}`,
    `
    <p>Promotion request for <strong>${esc(targetEmail)}</strong> was
      <span style="font-weight:bold;color:${statusColor};">${status.toLowerCase()}</span>.
    </p>
    ${reasonHtml}
  `,
  );
  await transporter.sendMail({ from: FROM, to: recipients.join(','), subject, text, html });
}
