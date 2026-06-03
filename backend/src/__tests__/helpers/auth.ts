// Purpose: Test auth helper – mint signed JWT access tokens for integration tests
// Dependencies: jsonwebtoken, JWT_PRIVATE_KEY_BASE64 env var

import jwt from 'jsonwebtoken';
import { TEST_USER_ID } from './seed';

export function getTestToken(email: string, userId: string = TEST_USER_ID): string {
  const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, 'base64').toString();
  return jwt.sign({ sub: userId, email }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  } as any);
}
