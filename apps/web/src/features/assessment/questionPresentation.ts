import type { LearnerQuestionPresentation } from './api/attempt-client';

export function optionLabel(index: number, presentation?: LearnerQuestionPresentation, legacyText?: string, legacyLatin = false): string {
  const custom = presentation?.optionLabels?.[index]?.trim();
  if (custom) return custom;
  if (!presentation && legacyText && /^[a-d]$/i.test(legacyText.trim())) return legacyText.trim().toUpperCase();
  const latin = presentation?.optionLabelStyle === 'latin' || (!presentation && legacyLatin);
  return (latin ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['أ', 'ب', 'ج', 'د', 'هـ', 'و'])[index] || String(index + 1);
}

export function showOptionText(presentation: LearnerQuestionPresentation | undefined, embedded: boolean): boolean {
  return presentation?.showOptionText ?? !embedded;
}
