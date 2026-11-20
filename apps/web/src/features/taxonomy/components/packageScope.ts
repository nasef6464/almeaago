import type { CommercePackageItem } from '../../commerce/api/commerce-types';

export function packageAppliesToPath(
  items: CommercePackageItem[], pathId: string,
  subjects: ReadonlyArray<{id: string; pathId: string}>,
  courses: ReadonlyArray<{id: string; pathId?: string}> = [],
): boolean {
  return items.some((item) => {
    switch (item.scopeType) {
      case 'all':
      case 'content_type': return true;
      case 'path': return item.pathId === pathId;
      case 'subject': return subjects.some((subject) => subject.id === item.subjectId && subject.pathId === pathId);
      case 'course': return courses.some((course) => course.id === item.courseId && course.pathId === pathId);
      default: return false;
    }
  });
}
