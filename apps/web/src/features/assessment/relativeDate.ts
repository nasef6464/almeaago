// Compact Arabic relative date for learner-facing rows. Handles both past
// results ("أمس") and upcoming deadlines ("غدًا"). Falls back to a short
// Gregorian date for older or far-future records.
export function relativeArabicDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const dayStart = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const days = Math.round((dayStart(new Date()) - dayStart(date)) / 86_400_000);
  const distance = Math.abs(days);

  if (days === 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === -1) return 'غدًا';
  if (days === 2) return 'منذ يومين';
  if (days === -2) return 'بعد يومين';
  if (days > 2 && distance < 11) return `منذ ${distance} أيام`;
  if (days < -2 && distance < 11) return `بعد ${distance} أيام`;
  if (days > 2 && distance < 30) return `منذ ${distance} يومًا`;
  if (days < -2 && distance < 30) return `بعد ${distance} يومًا`;

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
