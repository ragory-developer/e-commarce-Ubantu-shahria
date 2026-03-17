// ─── src/auth/auth.constants.ts ──────────────────────────────

export const AUTH_CONFIG = {
  // ─── JWT ──────────────────────────────────────────────────────
  ACCESS_TOKEN_EXPIRES_IN: 15 * 60 * 1000, // 15 minutes in ms
  REFRESH_TOKEN_EXPIRES_IN: 7,
  REFRESH_TOKEN_EXPIRES_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms

  // ─── Login Security ───────────────────────────────────────────
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MIN: 15, // minutes
  LOCK_DURATION_MS: 15 * 60 * 1000, // 15 minutes in ms

  // ─── Password ─────────────────────────────────────────────────
  BCRYPT_ROUNDS: 12,

  // ─── Admin Seeding ────────────────────────────────────────────
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? '',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD ?? '',
  SUPER_ADMIN_FIRST_NAME: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super',
  SUPER_ADMIN_LAST_NAME: process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin',
} as const;

export const AUTH_ERROR = {
  // ─── Generic ──────────────────────────────────────────────────
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_DISABLED: 'Account is disabled',
  ACCOUNT_LOCKED:
    'Account is temporarily locked due to too many failed login attempts',
  TOKEN_INVALID: 'Token is invalid or expired',
  TOKEN_REVOKED: 'Token has been revoked',
  REFRESH_TOKEN_REUSE:
    'Security alert: refresh token reuse detected. All sessions revoked',
  UNAUTHORIZED: 'Unauthorized',

  // ─── Admin ────────────────────────────────────────────────────
  ADMIN_NOT_FOUND: 'Admin not found',
  ADMIN_EMAIL_TAKEN: 'Email is already registered',
  ADMIN_INSUFFICIENT_ROLE: 'Insufficient role to perform this action',

  // ─── Customer ─────────────────────────────────────────────────
  CUSTOMER_NOT_FOUND: 'Customer not found',
  CUSTOMER_PHONE_TAKEN: 'Phone number is already registered',
  CUSTOMER_EMAIL_TAKEN: 'Email is already registered',
  CUSTOMER_NOT_VERIFIED: 'Phone number is not verified',
  CUSTOMER_IS_GUEST:
    'Please complete registration before logging in with password',

  // ─── OTP ──────────────────────────────────────────────────────
  OTP_REQUIRED: 'OTP verification is required',
  OTP_INVALID: 'Invalid OTP code',
  OTP_REGISTRATION_TOKEN_INVALID:
    'Registration token is invalid or expired. Please restart registration.',
} as const;

// JWT payload type identifier
export const JWT_PAYLOAD_VERSION = 1;
// Short-lived registration token: 15 minutes
export const REGISTRATION_TOKEN_EXPIRES_IN = '15m';
export const REGISTRATION_TOKEN_EXPIRES_MS = 15 * 60 * 1000;
