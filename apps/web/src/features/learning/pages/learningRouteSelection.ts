import type { TaxonomySubject } from '../../content/api/content-types';

export type LearningTab = 'courses' | 'foundation' | 'questions' | 'exams' | 'library';

const legacyTabMap: Record<string, LearningTab> = {
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

/** Keep the original category URL contract independent of the new Go API. */
export function parseLearningRoute(legacyPathId: string, params: URLSearchParams) {
  return {
    pathId: legacyPathId || params.get('pathId') || '',
    levelId: params.get('level') || '',
    subjectId: params.get('subjectId') || params.get('subject') || '',
    tab: legacyTabMap[params.get('tab') || 'courses'] || 'courses',
  };
}

export function subjectsForSelection(subjects: TaxonomySubject[], pathId: string, levelId: string) {
  return subjects.filter((subject) =>
    (!pathId || subject.pathId === pathId) && (!levelId || subject.levelId === levelId));
}
