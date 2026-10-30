export type CatalogPath = { id: string; code?: string; name?: string };
export type CatalogLevel = { id: string; code?: string; name?: string; pathId: string };
export type CatalogSubject = { id: string; code?: string; name?: string; pathId: string; levelId?: string };

export type Catalog = {
  paths: CatalogPath[];
  levels: CatalogLevel[];
  subjects: CatalogSubject[];
};

export const tabMap: Record<string, string> = {
  courses: 'courses',
  skills: 'foundation',
  foundation: 'foundation',
  banks: 'questions',
  questions: 'questions',
  tests: 'exams',
  exams: 'exams',
  'mock-exams': 'exams',
  library: 'library',
};

export function resolveLearningRoute(pathKey: string, params: URLSearchParams, catalog: Catalog) {
  const path = catalog.paths.find((p) => p.id === pathKey || p.code === pathKey);
  const pathId = path?.id || '';

  const rawLevel = params.get('level') || '';
  const level = pathId
    ? catalog.levels.find((l) => l.pathId === pathId && (l.id === rawLevel || l.code === rawLevel))
    : undefined;
  const levelId = level?.id || '';

  const rawSubject = params.get('subject') || params.get('subjectId') || '';
  let subjectId = '';
  let invalidScope = false;

  if (rawSubject && pathId) {
    const subject = catalog.subjects.find((s) => s.id === rawSubject || s.code === rawSubject);
    if (subject) {
      if (subject.pathId !== pathId) {
        invalidScope = true;
      } else if (rawLevel && (!levelId || (subject.levelId && subject.levelId !== levelId))) {
        subjectId = '';
      } else {
        subjectId = subject.id;
      }
    } else {
      invalidScope = true;
    }
  }

  const rawTab = params.get('tab') || 'courses';
  const tab = tabMap[rawTab] || 'courses';

  return {
    pathId,
    subjectId,
    levelId,
    tab,
    invalidScope,
  };
}

export function updateLearningQuery(
  current: URLSearchParams,
  field: 'pathId' | 'subjectId' | 'levelId' | 'tab',
  value: string | null,
  isLegacy = true,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (field === 'pathId') {
    if (isLegacy) {
      next.delete('subject');
      next.delete('subjectId');
      next.delete('level');
    }
  } else if (field === 'subjectId') {
    if (isLegacy) {
      if (value) {
        next.set('subject', value);
      } else {
        next.delete('subject');
      }
      next.delete('subjectId');
    }
  }
  return next;
}
