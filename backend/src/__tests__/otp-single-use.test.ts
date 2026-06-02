/**
 * otp-single-use.test.ts — security regression: an OTP must be consumed after
 * a single verification attempt (success OR failure), so an attacker gets at
 * most one guess per issued code. Uses Redis; runs against the dev/CI Redis.
 */
import { createAndStoreOtp, verifyOtp } from '../services/otp.service';

describe('OTP single-use', () => {
  it('accepts the correct code exactly once', async () => {
    const email = `otp-su-${Date.now()}@example.de`;
    const code = await createAndStoreOtp(email);

    expect(await verifyOtp(email, code)).toBe(true);
    // Second attempt with the same (now-consumed) code must fail.
    expect(await verifyOtp(email, code)).toBe(false);
  });

  it('consumes the code even after a wrong guess', async () => {
    const email = `otp-su2-${Date.now()}@example.de`;
    const code = await createAndStoreOtp(email);

    expect(await verifyOtp(email, '000000')).toBe(false);
    // The wrong guess still consumed the stored OTP — the real code now fails.
    expect(await verifyOtp(email, code)).toBe(false);
  });
});
