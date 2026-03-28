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
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
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
        This is an automated message from the DSF Allow List Management Portal.
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
  if (adminEmails.length === 0) return;

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

  const html = baseHtml('New Approval Request', `
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
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/approvals"
         style="display:inline-block;padding:10px 20px;background:${BRAND};color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
        Review in Portal
      </a>
    </p>
  `);

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
  if (adminEmails.length === 0) return;

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
  ].filter(line => line !== '').join('\n');

  const commentHtml = comment
    ? `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">Comment</td>
           <td style="padding:6px 0;">${esc(comment)}</td></tr>`
    : '';

  const html = baseHtml(`Request ${status.charAt(0) + status.slice(1).toLowerCase()}`, `
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
  `);

  await transporter.sendMail({ from: FROM, to: adminEmails.join(','), subject, text, html });
}

export async function sendSiteApprovalResultEmail(
  contactEmails: string[],
  orgName: string,
  status: 'APPROVED' | 'REJECTED',
  comment: string | null,
): Promise<void> {
  if (contactEmails.length === 0) return;

  const subject = `[DSF Allow List – ${ENV}] Your request has been ${status.toLowerCase()} – ${orgName}`;

  const commentLine = comment ? `\n\nComment from the reviewer:\n${comment}` : '';
  const text = [
    `DSF Allow List – ${ENV}`,
    ``,
    `Your approval request for ${orgName} has been ${status.toLowerCase()}.`,
    commentLine,
    ``,
    `If you have questions, please contact the GECKO team.`,
  ].filter(s => s !== '').join('\n');

  const commentHtml = comment
    ? `<div style="margin-top:16px;padding:12px;background:#f8f8fb;border-left:4px solid #ddd;border-radius:4px;">
         <p style="margin:0 0 4px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reviewer comment</p>
         <p style="margin:0;">${esc(comment)}</p>
       </div>`
    : '';

  const outcomeColor = status === 'APPROVED' ? COLOR_APPROVED : COLOR_REJECTED;
  const outcomeText = status === 'APPROVED'
    ? 'Congratulations – your DSF Allow List entry has been approved.'
    : 'Unfortunately, your DSF Allow List request was not approved at this time.';

  const html = baseHtml(`Request ${status.charAt(0) + status.slice(1).toLowerCase()}`, `
    <div style="padding:16px;border-radius:8px;border:2px solid ${outcomeColor};margin-bottom:20px;">
      <p style="margin:0;">${statusBadge(status)}&nbsp;&nbsp;${outcomeText}</p>
    </div>
    ${commentHtml}
    <p style="margin-top:20px;font-size:13px;color:#555;">
      If you have questions or wish to resubmit, please log in to the portal or contact the GECKO team.
    </p>
  `);

  await transporter.sendMail({ from: FROM, to: contactEmails.join(','), subject, text, html });
}
