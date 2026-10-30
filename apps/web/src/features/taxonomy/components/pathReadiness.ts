type PathScopedEntity = {
  pathId?: string | null;
  subjectId?: string | null;
  category?: string | null;
  showOnPlatform?: boolean;
  isPublished?: boolean;
  approvalStatus?: string | null;
  isPackage?: boolean;
};

type PathCourse = PathScopedEntity & {
  price?: number;
};

type PathSubject = {
  id: string;
  pathId?: string | null;
};

type PathReadinessInput = {
  pathId: string;
  subjects: PathSubject[];
  courses: PathCourse[];
  topics?: PathScopedEntity[];
  lessons?: PathScopedEntity[];
  quizzes?: PathScopedEntity[];
  libraryItems?: PathScopedEntity[];
};

export type PathReadinessSummary = {
  total: number;
  visible: number;
  hidden: number;
  subjects: number;
  packages: number;
};

const isApproved = (item: PathScopedEntity) => !item.approvalStatus || item.approvalStatus === 'approved';

const isPublicCourseLike = (item: PathScopedEntity) =>
  item.showOnPlatform !== false &&
  item.isPublished !== false &&
  isApproved(item);

const isVisibleTopic = (item: PathScopedEntity) => item.showOnPlatform !== false;

const isVisibleLesson = (item: PathScopedEntity) =>
  item.showOnPlatform !== false &&
  (!item.approvalStatus || item.approvalStatus === 'approved');

export const buildPathReadinessSummary = ({
  pathId,
  subjects,
  courses,
  topics = [],
  lessons = [],
  quizzes = [],
  libraryItems = [],
}: PathReadinessInput): PathReadinessSummary => {
  const scopedSubjects = subjects.filter((subject) => subject.pathId === pathId);
  const subjectIds = new Set(scopedSubjects.map((subject) => subject.id));
  const scopedCourses = courses.filter((course) => (course.pathId || course.category) === pathId && !course.isPackage);
  const scopedPackages = courses.filter((course) => (course.pathId || course.category) === pathId && course.isPackage);
  const scopedTopics = topics.filter((topic) => topic.pathId === pathId || subjectIds.has(String(topic.subjectId || '')));
  const scopedLessons = lessons.filter((lesson) => lesson.pathId === pathId || subjectIds.has(String(lesson.subjectId || '')));
  const scopedQuizzes = quizzes.filter((quiz) => quiz.pathId === pathId || subjectIds.has(String(quiz.subjectId || '')));
  const scopedLibrary = libraryItems.filter((item) => item.pathId === pathId || subjectIds.has(String(item.subjectId || '')));

  const rows = [
    {
      total: scopedCourses.length,
      visible: scopedCourses.filter(isPublicCourseLike).length,
    },
    {
      total: scopedPackages.length,
      visible: scopedPackages.filter(isPublicCourseLike).length,
    },
    {
      total: scopedTopics.length,
      visible: scopedTopics.filter(isVisibleTopic).length,
    },
    {
      total: scopedLessons.length,
      visible: scopedLessons.filter(isVisibleLesson).length,
    },
    {
      total: scopedQuizzes.length,
      visible: scopedQuizzes.filter(isPublicCourseLike).length,
    },
    {
      total: scopedLibrary.length,
      visible: scopedLibrary.filter(isVisibleLesson).length,
    },
  ];

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const visible = rows.reduce((sum, row) => sum + row.visible, 0);
  const hidden = rows.reduce((sum, row) => sum + Math.max(row.total - row.visible, 0), 0);
  const visiblePackages = scopedPackages.filter(isPublicCourseLike).length;

  return {
    total,
    visible,
    hidden,
    subjects: scopedSubjects.length,
    packages: visiblePackages,
  };
};
