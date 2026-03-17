import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // ─── Required ─────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(16).required(),

  // ─── Optional with defaults ───────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  ENABLE_SWAGGER: Joi.string().valid('true', 'false').default('false'),

  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  BCRYPT_ROUNDS: Joi.number().min(10).max(14).default(12),

  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
  SUPER_ADMIN_FIRST_NAME: Joi.string().default('Super'),
  SUPER_ADMIN_LAST_NAME: Joi.string().default('Admin'),

  // ─── Email OTP Configuration ──────────────────────────────
  EMAIL_HOST: Joi.string().optional(),
  EMAIL_PORT: Joi.number().optional(),
  EMAIL_SECURE: Joi.boolean().optional(),
  EMAIL_USER: Joi.string().optional(),
  EMAIL_PASSWORD: Joi.string().optional(),
  EMAIL_FROM_NAME: Joi.string().default('Your Store'),
  EMAIL_FROM_ADDRESS: Joi.string().email().optional(),

  // ─── SMS OTP Configuration ────────────────────────────────
  SMS_API_KEY: Joi.string().optional(),
  SMS_SENDER_ID: Joi.string().optional(),
  SMS_BASE_URL: Joi.string().uri().optional(),

  // ! local storage / media
  STORAGE_DRIVER: Joi.string()
    .valid('local', 'cloudinary')
    .default('cloudinary'),
  LOCAL_STORAGE_PATH: Joi.string().default('./storage/media'),
  LOCAL_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3001/uploads/media'),
  MAX_UPLOAD_SIZE_MB: Joi.number().min(1).default(10),

  // ! cloudinary optional unless storage driver
  CLOUDINARY_URL: Joi.string().optional(),
  CLOUDINARY_CLOUD_NAME: Joi.when('STORAGE_DRIVER', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  CLOUDINARY_API_KEY: Joi.when('STORAGE_DRIVER', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  CLOUDINARY_API_SECRET: Joi.when('STORAGE_DRIVER', {
    is: 'cloudinary',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
});
