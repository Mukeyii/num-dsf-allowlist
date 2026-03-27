/**
 * mail.service.ts – Email sending via Nodemailer
 * Dependencies: nodemailer, .env (SMTP_*)
 *
 * In dev: Mailhog on port 1025 (no auth required)
 * In prod: SMTP relay (e.g. Sendgrid) via SMTP_USER + SMTP_PASS
 */
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const environment = process.env.DSF_ENVIRONMENT || 'TEST';

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'noreply@dsf-allowlist.local',
    to,
    subject: `[DSF Allow List – ${environment}] Your login code`,
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes and can only be used once.\n\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6c63ff;">DSF Allow List – ${environment}</h2>
        <p>Your login code:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                    padding: 20px; background: #f0f2f8; border-radius: 8px;
                    text-align: center; font-family: monospace; color: #1a1a2e;">
          ${code}
        </div>
        <p style="color: #9b9fad; font-size: 13px; margin-top: 20px;">
          This code expires in <strong>10 minutes</strong> and can only be used once.<br>
          If you did not request this, please ignore this email.
        </p>
      </div>
    `,
  });
}
