import type { LearnerQuestionPresentation } from './api/attempt-client';
import DOMPurify from 'dompurify';

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

const QUESTION_BLANK_PATTERN = /(?:\.{3,}|…{2,}|_{3,}|ـ{3,})/g;

export const formatQuestionHtmlForDisplay = (value?: string | null): string => {
  if (!value) return '';
  // Sanitize before using HTML; build the blank markers from text nodes only,
  // so user-supplied attributes or markup cannot be created by interpolation.
  const fragment = DOMPurify.sanitize(value, { RETURN_DOM_FRAGMENT: true });
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const text = node.data;
    const matches = [...text.matchAll(QUESTION_BLANK_PATTERN)];
    if (!matches.length) continue;
    const replacement = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      const index = match.index ?? 0;
      replacement.append(document.createTextNode(text.slice(offset, index)));
      const marker = document.createElement('span');
      marker.className = 'question-blank font-mono px-1 rounded bg-amber-50 border border-amber-200';
      marker.dir = 'ltr';
      marker.textContent = match[0];
      replacement.append(marker);
      offset = index + match[0].length;
    }
    replacement.append(document.createTextNode(text.slice(offset)));
    node.replaceWith(replacement);
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
};

export type QuizQuestionMapState = 'current' | 'answered' | 'review' | 'unanswered' | 'correct' | 'wrong';

export const getQuizQuestionMapButtonClass = (
  state: QuizQuestionMapState,
  isNightMode = false,
): string => {
  if (state === 'current') {
    return isNightMode
      ? 'border-amber-300 bg-amber-500 text-white shadow-sm ring-2 ring-amber-900/60'
      : 'border-amber-600 bg-amber-500 text-white shadow-sm ring-2 ring-amber-200';
  }
  if (state === 'answered' || state === 'correct') {
    return isNightMode
      ? 'border-emerald-300 bg-emerald-500 text-white shadow-sm'
      : 'border-emerald-600 bg-emerald-500 text-white shadow-sm';
  }
  if (state === 'review') {
    return isNightMode
      ? 'border-purple-300 bg-purple-600 text-white shadow-sm shadow-purple-950/30'
      : 'border-purple-600 bg-purple-500 text-white shadow-sm';
  }
  if (state === 'wrong') {
    return isNightMode
      ? 'border-rose-300 bg-rose-500 text-white shadow-sm'
      : 'border-rose-600 bg-rose-500 text-white shadow-sm';
  }
  return isNightMode
    ? 'border-slate-600 bg-slate-950 text-slate-300 hover:border-amber-400 hover:bg-slate-800'
    : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50';
};

export const getQuizOptionGridClass = (
  options: Array<{ text: string }> = [],
  optionLayout = 'auto',
): string => {
  const longestLength = options.reduce((max, opt) => Math.max(max, DOMPurify.sanitize(opt?.text || '', { ALLOWED_TAGS: [] }).length), 0);
  if (optionLayout === 'horizontal') {
    return longestLength > 72 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4';
  }
  return longestLength > 72 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4';
};

export const formatTimerCountdown = (totalSeconds: number): string => {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

