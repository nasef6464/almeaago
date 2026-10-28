export type LoginInputType = 'email' | 'phone' | 'nationalId' | 'unknown';

// Match Legacy's nationalIdLoginSchema preprocessing for Arabic-Indic digits.
export function normalizeArabicIndicDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

export function identifyLoginInput(value: string): LoginInputType {
  const normalized = normalizeArabicIndicDigits(value.trim());
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
