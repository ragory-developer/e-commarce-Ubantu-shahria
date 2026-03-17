// ─── src/otp/otp.constants.ts ────────────────────────────────

export const OTP_CONFIG = {
  CODE_LENGTH: 6,

  // Must include ALL OtpPurpose enum values to prevent runtime undefined errors
  EXPIRY_SECONDS: {
    VERIFY_PHONE: 5 * 60, // 5 minutes
    VERIFY_EMAIL: 5 * 60, // 5 minutes
    RESET_PASSWORD: 5 * 60, // 5 minutes
    LOGIN_OTP: 5 * 60, // 5 minutes
    REGISTER_ACCOUNT: 5 * 60, // 5 minutes
  } as const satisfies Record<string, number>,

  MAX_ATTEMPTS: 5,
  LOCK_MINUTES: 15,

  RATE_LIMIT: {
    MAX_PER_HOUR: 5,
    MAX_PER_DAY: 20,
    WINDOW_MS: 60 * 60 * 1000, // 1 hour
  },

  RESEND_COOLDOWN_SECONDS: 60,
} as const;

export const OTP_ERROR = {
  NOT_FOUND: 'OTP not found or already used',
  EXPIRED: 'OTP has expired. Please request a new one',
  MAX_ATTEMPTS: 'Too many incorrect attempts. Please request a new OTP',
  INVALID: 'Invalid OTP code',
  RATE_LIMIT: 'Too many OTP requests. Please try again later',
  COOLDOWN: `Please wait ${OTP_CONFIG.RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP`,
} as const;
