/**
 * clientCert.test.ts — extractClientCert must trust the X-Client-Cert header
 * ONLY when nginx's mTLS verification succeeded (X-Client-Verify === SUCCESS).
 * A request that supplies a cert header but no/failed verify result is
 * rejected (null) before any thumbprint is computed, so a spoofed cert can
 * never reach an org lookup.
 *
 * Dependencies: lib/clientCert (pure — no DB/Redis).
 */
import type { Request } from 'express';
import { extractClientCert } from '../lib/clientCert';

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeO
-----END CERTIFICATE-----`;

function reqWith(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('extractClientCert – X-Client-Verify gating', () => {
  const encodedCert = encodeURIComponent(SAMPLE_PEM);

  it('returns a thumbprint when verify succeeded', () => {
    const result = extractClientCert(
      reqWith({ 'x-client-verify': 'SUCCESS', 'x-client-cert': encodedCert }),
    );
    expect(result).not.toBeNull();
    expect(typeof result!.thumbprint).toBe('string');
    expect(result!.thumbprint).toHaveLength(64);
  });

  it('rejects a cert header when X-Client-Verify is absent', () => {
    expect(extractClientCert(reqWith({ 'x-client-cert': encodedCert }))).toBeNull();
  });

  it('rejects a cert header when X-Client-Verify is NONE', () => {
    expect(
      extractClientCert(reqWith({ 'x-client-verify': 'NONE', 'x-client-cert': encodedCert })),
    ).toBeNull();
  });

  it('rejects a cert header when verification FAILED', () => {
    expect(
      extractClientCert(
        reqWith({ 'x-client-verify': 'FAILED:self signed', 'x-client-cert': encodedCert }),
      ),
    ).toBeNull();
  });
});
