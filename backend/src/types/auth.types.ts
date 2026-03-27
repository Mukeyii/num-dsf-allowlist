/**
 * auth.types.ts – TypeScript interfaces for the auth flow
 * Dependencies: none
 */

export interface AuthUser {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export interface JwtPayload {
  sub: string;       // user.id
  email: string;
  iat: number;
  exp: number;
}

// Temporary token after OTP verification (before TOTP)
export interface TempTokenPayload {
  sub: string;
  email: string;
  purpose: 'totp_required' | 'totp_setup';
  iat: number;
  exp: number;
}

export interface OtpRequestBody {
  email: string;
}

export interface OtpVerifyBody {
  email: string;
  code: string;
}

export interface TotpVerifyBody {
  tempToken: string;
  code: string;
}

export interface TotpConfirmBody {
  tempToken: string;
  code: string;
}
