export type LoginInputType = 'email' | 'phone' | 'nationalId' | 'unknown';

export function identifyLoginInput(value: string): LoginInputType {
  const normalized = value.trim();
  if (normalized.includes('@')) {
    return 'email';
  }

  const digits = normalized.replace(/\D/g, '');
  if (/^[12]\d{9}$/.test(digits)) {
    return 'nationalId';
  }
  if (digits.length >= 8) {
    return 'phone';
  }
  return 'unknown';
}
