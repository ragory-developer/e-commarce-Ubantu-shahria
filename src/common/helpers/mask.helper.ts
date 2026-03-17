/**
 * Mask a phone number for privacy.
 * "01700000000" → "0170****000"
 */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return '****';
  return `${phone.substring(0, 4)}****${phone.substring(phone.length - 3)}`;
}

/**
 * Mask an email address for privacy.
 * "john.doe@example.com" → "jo****@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const visible = local.length > 2 ? local.substring(0, 2) : local[0];
  return `${visible}****@${domain}`;
}
