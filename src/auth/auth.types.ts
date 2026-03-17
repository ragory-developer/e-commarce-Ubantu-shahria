// ─── src/auth/auth.types.ts ───────────────────────────────────

import { AdminRole, AdminPermission, AuthUserType } from '@prisma/client';

// ─── JWT Payload ──────────────────────────────────────────────
// This is what gets encoded inside the access token.
// Keep it small — it's in every request header.

export interface JwtPayload {
  sub: string; // user id (adminId or customerId)
  type: AuthUserType; // 'ADMIN' | 'CUSTOMER'
  deviceId: string; // DB Device.id (not client deviceId)
  role?: AdminRole; // only for admins
  permissions?: AdminPermission[]; // only for admins
  iat?: number; // issued at (added by JWT library)
  exp?: number; // expiry (added by JWT library)
}

// ─── Request User ─────────────────────────────────────────────
// Attached to req.user by JwtStrategy after token validation.

export interface RequestUser {
  id: string;
  type: AuthUserType;
  deviceId: string;
  role?: AdminRole;
  permissions?: AdminPermission[];
}

// ─── Token Pair ───────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

// ─── Device Info ──────────────────────────────────────────────
// Parsed from request headers.

export interface DeviceInfo {
  clientDeviceId: string; // UUID sent by client, stable across sessions
  deviceName?: string; // "iPhone 15 Pro", "Chrome on Mac"
  deviceType?: string; // "mobile" | "tablet" | "desktop"
  ipAddress?: string;
  userAgent?: string;
}

// ─── Auth Result ──────────────────────────────────────────────
export interface AuthResult {
  tokens: TokenPair;
  deviceDbId: string; // DB Device.id for reference
}

// ─── Registration Token Payload ───────────────────────────────
// Issued after OTP verification, consumed during registration completion
export interface RegistrationTokenPayload {
  sub: string; // phone number
  purpose: 'REGISTRATION';
  iat?: number;
  exp?: number;
}
