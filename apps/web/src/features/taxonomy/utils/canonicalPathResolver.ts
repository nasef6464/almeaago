export interface MinimalPath {
  id: string;
  code?: string;
  name: string;
  [key: string]: any;
}

export interface MinimalSubject {
  id: string;
  pathId?: string;
  levelId?: string | null;
  code?: string;
  name: string;
  [key: string]: any;
}

export const normalizeArabic = (value?: string | null): string =>
  (value || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // strip tashkeel
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

export const pathAliasGroups: Record<string, string[]> = {
  qudrat: ['qudrat', 'p_qudrat', 'القدرات', 'قدرات', '018f0000-0000-7000-8000-000000000030'],
  tahsili: ['tahsili', 'p_tahsili', 'التحصيلي', 'تحصيلي', 'd242dd63-2c42-54e1-81da-37322e5234a7'],
  nafes: ['nafes', 'p_nafes', 'نافس', 'اختبارات نافس', 'اختبارت نافس', 'a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44'],
  step: ['step', 'p_step', 'ستيب', 'الستيب'],
};

export const subjectAliasGroups: Record<string, string[]> = {
  quant: ['quant', 'sub_quant', 'كمي', 'الكمي', 'قدرات كمي', 'القدرات الكمية'],
  verbal: ['verbal', 'sub_verbal', 'لفظي', 'اللفظي', 'قدرات لفظي', 'القدرات اللفظية'],
  math: ['math', 'sub_math', 'math_tahsili', 'math_nafes', 'رياضيات', 'الرياضيات'],
  physics: ['physics', 'sub_physics', 'فيزياء', 'الفيزياء'],
  chemistry: ['chemistry', 'sub_chemistry', 'كيمياء', 'الكيمياء'],
  biology: ['biology', 'sub_biology', 'احياء', 'الاحياء', 'الأحياء'],
  ecology: ['ecology', 'sub_ecology', 'علم البيئة', 'بيئة', 'البيئة'],
  science: ['science', 'science_nafes', 'علوم', 'العلوم'],
  arabic: ['arabic', 'arabic_nafes', 'لغتي', 'عربي', 'اللغة العربية'],
};

/**
 * Resolves a raw URL parameter (UUID, code, English alias, or Arabic name)
 * to the exact canonical path object from the loaded paths collection.
 */
export function resolveCanonicalPath<T extends MinimalPath>(
  raw: string | undefined | null,
  paths: T[],
): T | undefined {
  if (!raw || !paths || paths.length === 0) return undefined;
  const rawTrimmed = raw.trim();
  const rawLower = rawTrimmed.toLowerCase();
  const rawNorm = normalizeArabic(rawTrimmed);

  // 1. Direct ID match (case-insensitive)
  const byId = paths.find((p) => p.id.toLowerCase() === rawLower);
  if (byId) return byId;

  // 2. Direct Code match (case-insensitive)
  const byCode = paths.find((p) => p.code && p.code.toLowerCase() === rawLower);
  if (byCode) return byCode;

  // 3. Direct Normalized Name match
  const byName = paths.find((p) => normalizeArabic(p.name) === rawNorm);
  if (byName) return byName;

  // 4. Name contains or is contained in raw
  const byNameFuzzy = paths.find((p) => {
    const norm = normalizeArabic(p.name);
    return norm.includes(rawNorm) || rawNorm.includes(norm);
  });
  if (byNameFuzzy) return byNameFuzzy;

  // 5. Look up by known aliases group
  for (const group of Object.values(pathAliasGroups)) {
    const matchesGroup = group.some((alias) => {
      const aliasLower = alias.toLowerCase();
      const aliasNorm = normalizeArabic(alias);
      return aliasLower === rawLower || aliasNorm === rawNorm;
    });

    if (matchesGroup) {
      // Find which path in `paths` also matches this group
      const matchedPath = paths.find((p) => {
        const pLowerId = p.id.toLowerCase();
        const pLowerCode = (p.code || '').toLowerCase();
        const pNormName = normalizeArabic(p.name);
        return group.some(
          (alias) =>
            alias.toLowerCase() === pLowerId ||
            alias.toLowerCase() === pLowerCode ||
            normalizeArabic(alias) === pNormName ||
            pNormName.includes(normalizeArabic(alias)),
        );
      });
      if (matchedPath) return matchedPath;
    }
  }

  return undefined;
}

/**
 * Resolves a raw subject parameter (UUID, code, alias, or Arabic name)
 * to the exact subject within an optionally scoped path.
 */
export function resolveCanonicalSubject<T extends MinimalSubject>(
  raw: string | undefined | null,
  subjects: T[],
  canonicalPathId?: string,
): T | undefined {
  if (!raw || !subjects || subjects.length === 0) return undefined;
  const rawTrimmed = raw.trim();
  const rawLower = rawTrimmed.toLowerCase();
  const rawNorm = normalizeArabic(rawTrimmed);

  const candidateSubjects = canonicalPathId
    ? subjects.filter((s) => !s.pathId || s.pathId === canonicalPathId)
    : subjects;

  // 1. Direct ID match
  const byId = candidateSubjects.find((s) => s.id.toLowerCase() === rawLower);
  if (byId) return byId;

  // 2. Direct Code match
  const byCode = candidateSubjects.find((s) => s.code && s.code.toLowerCase() === rawLower);
  if (byCode) return byCode;

  // 3. Direct Normalized Name match
  const byName = candidateSubjects.find((s) => normalizeArabic(s.name) === rawNorm);
  if (byName) return byName;

  // 4. Fuzzy Name match
  const byNameFuzzy = candidateSubjects.find((s) => {
    const norm = normalizeArabic(s.name);
    return norm.includes(rawNorm) || rawNorm.includes(norm);
  });
  if (byNameFuzzy) return byNameFuzzy;

  // 5. Look up by known aliases group
  for (const group of Object.values(subjectAliasGroups)) {
    const matchesGroup = group.some((alias) => {
      const aliasLower = alias.toLowerCase();
      const aliasNorm = normalizeArabic(alias);
      return aliasLower === rawLower || aliasNorm === rawNorm;
    });

    if (matchesGroup) {
      const matched = candidateSubjects.find((s) => {
        const sLowerId = s.id.toLowerCase();
        const sLowerCode = (s.code || '').toLowerCase();
        const sNormName = normalizeArabic(s.name);
        return group.some(
          (alias) =>
            alias.toLowerCase() === sLowerId ||
            alias.toLowerCase() === sLowerCode ||
            normalizeArabic(alias) === sNormName ||
            sNormName.includes(normalizeArabic(alias)),
        );
      });
      if (matched) return matched;
    }
  }

  return undefined;
}
