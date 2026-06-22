/**
 * mail.service.test.ts – unit test for sendOtpEmail.
 * Mocks nodemailer so createTransport yields a transport whose sendMail is a
 * jest spy (no real SMTP). Asserts the envelope (from=MAIL_FROM, to=recipient,
 * subject present, text+html contain the 6-digit code), that the code is never
 * written to stdout/stderr (the service must not log the secret), and that a
 * rejecting sendMail propagates to the caller.
 * Deterministic, no DB.
 * Dependencies: nodemailer (mocked), mail.service
 */
const sendMailMock = jest.fn<Promise<unknown>, [Record<string, unknown>]>();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
  },
}));

import nodemailer from 'nodemailer';
import { sendOtpEmail } from '../services/mail.service';

describe('mail.service – sendOtpEmail', () => {
  const recipient = `otp-${Date.now()}@example.de`;
  const code = '482915'; // a concrete 6-digit code
  let savedFrom: string | undefined;
  let savedEnv: string | undefined;

  beforeAll(() => {
    savedFrom = process.env.MAIL_FROM;
    savedEnv = process.env.DSF_ENVIRONMENT;
    process.env.MAIL_FROM = 'noreply@dsf-test.de';
    process.env.DSF_ENVIRONMENT = 'TEST';
  });

  afterAll(() => {
    if (savedFrom === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = savedFrom;
    if (savedEnv === undefined) delete process.env.DSF_ENVIRONMENT;
    else process.env.DSF_ENVIRONMENT = savedEnv;
  });

  beforeEach(() => {
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue({ messageId: 'test' });
  });

  it('creates a transport at module load', () => {
    expect(nodemailer.createTransport as jest.Mock).toHaveBeenCalled();
  });

  it('sends exactly one mail with the right envelope and the 6-digit code', async () => {
    await sendOtpEmail(recipient, code);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const msg = sendMailMock.mock.calls[0][0];

    expect(msg.from).toBe('noreply@dsf-test.de');
    expect(msg.to).toBe(recipient);
    expect(typeof msg.subject).toBe('string');
    expect((msg.subject as string).length).toBeGreaterThan(0);

    // Both the plain-text and HTML bodies must carry the actual code.
    expect(typeof msg.text).toBe('string');
    expect(msg.text as string).toContain(code);
    expect(typeof msg.html).toBe('string');
    expect(msg.html as string).toContain(code);
  });

  it('reflects the configured environment in the subject', async () => {
    await sendOtpEmail(recipient, code);
    const msg = sendMailMock.mock.calls[0][0];
    expect(msg.subject as string).toContain('TEST');
  });

  it('does not write the code to stdout/stderr', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      await sendOtpEmail(recipient, code);
    } finally {
      const logged = [logSpy, errSpy, warnSpy, infoSpy]
        .flatMap((s) => s.mock.calls)
        .flat()
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      logSpy.mockRestore();
      errSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      expect(logged).not.toContain(code);
    }
  });

  it('propagates an SMTP send failure to the caller', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'));
    await expect(sendOtpEmail(recipient, code)).rejects.toThrow('smtp down');
  });
});
