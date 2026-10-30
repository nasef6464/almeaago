import type { CategoryPath, CategoryLevel, CategorySubject } from '../../learning/navigation/types';

export type HeaderNodeKind = 'home' | 'path' | 'level' | 'subject' | 'child-path' | 'mock-exam' | 'package' | 'divider' | 'more' | 'link';
export interface HeaderNode { id: string; label: string; href: string; kind: HeaderNodeKind; children?: HeaderNode[]; }
interface HeaderNavigationSettings { showAutoPaths?: boolean; moreLabel?: string; items?: Array<{ id: string; label?: string; visible?: boolean; order?: number }>; }
interface HeaderTaxonomy { paths: CategoryPath[]; levels?: CategoryLevel[]; subjects: CategorySubject[]; }
interface HeaderScope {
  navigationPathVisible?: (path: { id: string }) => boolean;
  matchesNavigationContent?: (item: { pathId?: string; category?: string; subjectId?: string; subject?: string; levelId?: string | null }) => boolean;
}
interface HeaderUser { role?: string; roles?: string[]; }
function sorted<T extends { sortOrder?: number }>(rows: T[]): T[] { return [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)); }

/** Mirrors the source header tree while applying the same learner path/stage scope as content. */
export function buildHeaderNavigation(taxonomy: HeaderTaxonomy, settings: HeaderNavigationSettings = {}, user?: HeaderUser | null, scope?: HeaderScope): HeaderNode[] {
  const navItem = (id: string) => settings.items?.find((item) => item.id === id);
  const visible = (id: string) => navItem(id)?.visible !== false;
  const label = (id: string, fallback: string) => navItem(id)?.label?.trim() || fallback;
  const order = (node: HeaderNode) => navItem(node.id)?.order ?? (node.kind === 'home' ? 50 : node.kind === 'more' ? 100 : 50);
  const menu: HeaderNode[] = [];
  const roles = [user?.role, ...(user?.roles || [])].filter((role): role is string => Boolean(role));
  const canSeeHiddenPaths = roles.some((role) => ['admin', 'teacher', 'supervisor'].includes(role));
  const pathVisible = (path: CategoryPath) => (canSeeHiddenPaths || path.isActive !== false) && path.showInNavbar !== false && (scope?.navigationPathVisible?.(path) ?? true);
  const contentVisible = (item: { pathId?: string; category?: string; subjectId?: string; subject?: string; levelId?: string | null }) => scope?.matchesNavigationContent?.(item) ?? true;

  if (visible('home')) menu.push({ id: 'home', label: label('home', 'الرئيسية'), href: '/', kind: 'home' });
  const eligible = sorted(taxonomy.paths.filter((path) => path.id?.trim() && path.name?.trim() && pathVisible(path)));
  const roots = eligible.filter((path) => !path.parentPathId);
  const children = eligible.filter((path) => Boolean(path.parentPathId));

  if (settings.showAutoPaths !== false) {
    for (const path of roots) {
      const items: HeaderNode[] = [];
      const levels = sorted((taxonomy.levels || []).filter((level) => level.pathId === path.id && contentVisible({ pathId: path.id, levelId: level.id })));
      const subjects = sorted(taxonomy.subjects.filter((subject) => subject.pathId === path.id && contentVisible({ pathId: path.id, levelId: subject.levelId, subjectId: subject.id })));
      for (const level of levels) {
        items.push({ id: level.id, label: level.name, href: `/category/${path.id}?level=${level.id}`, kind: 'level',
          children: subjects.filter((subject) => subject.levelId === level.id).map((subject) => ({ id: subject.id, label: subject.name, href: `/category/${path.id}?level=${level.id}&subject=${subject.id}`, kind: 'subject' })) });
      }
      for (const subject of subjects.filter((subject) => !subject.levelId || !levels.some((level) => level.id === subject.levelId))) {
        items.push({ id: subject.id, label: subject.name, href: `/category/${path.id}?subject=${subject.id}`, kind: 'subject' });
      }
      const childPaths = children.filter((child) => child.parentPathId === path.id);
      if (childPaths.length && items.length) items.push({ id: `${path.id}-divider-paths`, label: '', href: '', kind: 'divider' });
      for (const child of childPaths) items.push({ id: child.id, label: child.name, href: `/category/${child.id}`, kind: 'child-path' });
      if (subjects.length || levels.length || childPaths.length) {
        items.push({ id: `${path.id}-divider-actions`, label: '', href: '', kind: 'divider' });
        items.push({ id: `${path.id}_mock_exams`, label: `اختبارات محاكية ${path.name}`, href: `/category/${path.id}?tab=mock-exams`, kind: 'mock-exam' });
        items.push({ id: `${path.id}_packages`, label: `عروض وباقات ${path.name}`, href: `/category/${path.id}?tab=packages`, kind: 'package' });
      }
      menu.push({ id: path.id, label: path.name, href: `/category/${path.id}`, kind: 'path', ...(items.length ? { children: items } : {}) });
    }
  }
  const mockPaths = roots.filter((path) => path.settings?.showMockExamCard !== false);
  if (visible('mock-exams') && mockPaths.length) menu.push({ id: 'mock-exams', label: label('mock-exams', 'اختبارات محاكية'), href: '/mock-exams', kind: 'mock-exam',
    children: mockPaths.map((path) => ({ id: `mock-${path.id}`, label: path.name, href: `/category/${path.id}?tab=mock-exams`, kind: 'link' })) });
  const more: HeaderNode[] = [];
  if (visible('pricing')) more.push({ id: 'pricing', label: label('pricing', 'العضويات'), href: '/pricing', kind: 'link' });
  if (visible('blog')) more.push({ id: 'blog', label: label('blog', 'المدونة'), href: '/blog', kind: 'link' });
  if (more.length) menu.push({ id: 'more', label: settings.moreLabel?.trim() || 'أخرى', href: more.length === 1 ? more[0].href : '#', kind: 'more', children: more });
  return menu.sort((a, b) => order(a) - order(b));
}
