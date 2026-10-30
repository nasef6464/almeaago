export type PathsManagerPathTab = 'levels' | 'subjects' | 'mockExams' | 'packages' | 'settings';
export type PathsManagerSubjectTab = 'courses' | 'skills' | 'questions' | 'exams' | 'library' | 'settings';

export type PathsManagerUrlState = {
  selectedPathId: string | null;
  selectedSubjectId: string | null;
  pathTab: PathsManagerPathTab;
  subjectTab: PathsManagerSubjectTab;
};

const pathTabs: PathsManagerPathTab[] = ['levels', 'subjects', 'mockExams', 'packages', 'settings'];
const subjectTabs: PathsManagerSubjectTab[] = ['courses', 'skills', 'questions', 'exams', 'library', 'settings'];

const getInitialQuery = () =>
  new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search);

export const resolvePathsManagerUrlState = (): PathsManagerUrlState => {
  const initialQuery = getInitialQuery();
  const requestedPathTab = initialQuery.get('pathTab');
  const requestedSubjectTab = initialQuery.get('subjectTab') || initialQuery.get('courseTab') || initialQuery.get('workspace');

  return {
    selectedPathId: initialQuery.get('path') || null,
    selectedSubjectId: initialQuery.get('subject') || null,
    pathTab: pathTabs.includes(requestedPathTab as PathsManagerPathTab)
      ? (requestedPathTab as PathsManagerPathTab)
      : 'subjects',
    subjectTab: subjectTabs.includes(requestedSubjectTab as PathsManagerSubjectTab)
      ? (requestedSubjectTab as PathsManagerSubjectTab)
      : 'courses',
  };
};

const applyPathsManagerState = (params: URLSearchParams, state: PathsManagerUrlState) => {
  if (!state.selectedPathId) {
    params.delete('path');
    params.delete('pathTab');
    params.delete('subject');
    params.delete('subjectTab');
    params.delete('courseTab');
    params.delete('workspace');
    return;
  }

  params.set('path', state.selectedPathId);
  params.set('pathTab', state.pathTab);

  if (!state.selectedSubjectId) {
    params.delete('subject');
    params.delete('subjectTab');
    params.delete('courseTab');
    params.delete('workspace');
    return;
  }

  params.set('subject', state.selectedSubjectId);
  params.set('subjectTab', state.subjectTab);
  params.delete('courseTab');
  params.delete('workspace');
};

export const replacePathsManagerUrlState = (state: PathsManagerUrlState) => {
  if (typeof window === 'undefined') return;

  if (window.location.hash.includes('?')) {
    const [hashPath, rawHashQuery = ''] = window.location.hash.split('?');
    const hashParams = new URLSearchParams(rawHashQuery);
    applyPathsManagerState(hashParams, state);
    const query = hashParams.toString();
    const nextHash = query ? `${hashPath}?${query}` : hashPath;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    return;
  }

  const url = new URL(window.location.href);
  applyPathsManagerState(url.searchParams, state);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};
