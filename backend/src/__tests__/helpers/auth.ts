// Purpose: Test auth helper – mint signed JWT access tokens for integration tests
// Dependencies: jsonwebtoken, JWT_PRIVATE_KEY_BASE64 env var

import jwt from 'jsonwebtoken';

export function getTestToken(email: string): string {
  const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, 'base64').toString();
  return jwt.sign({ email, type: 'access' }, privateKey, { algorithm: 'RS256' as const, expiresIn: '15m' as string });
}
