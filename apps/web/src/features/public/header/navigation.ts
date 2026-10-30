import type {HomepageSettings} from '../../presentation/homepage-types';
export type HeaderPath={id:string;name:string;parentPathId?:string;isActive?:boolean;showInNavbar?:boolean;settings?:{showMockExamCard?:boolean;[key:string]:unknown}};
export type HeaderLevel={id:string;pathId:string;name:string};
export type HeaderSubject={id:string;pathId:string;levelId?:string|null;name:string;icon?:string;color?:string};
export type HeaderNavigationInput={homepageSettings?:Partial<HomepageSettings>|null;paths:HeaderPath[];levels:HeaderLevel[];subjects:HeaderSubject[];user?:{role?:string}|null;scope:{navigationPathVisible:(path:{id:string})=>boolean}};
// Reuse the original menu construction; authorization remains in Go services.
export function buildHeaderNavigation({homepageSettings,paths,levels,subjects,user,scope}:HeaderNavigationInput){
 const text={main:'الرئيسية',blog:'المدونة',offersPrefix:'عروض وباقات'};
    const navSettings = homepageSettings?.navigation || {};
    const navItems = navSettings.items || [];
    const getNavItem = (id: string) => navItems.find((item) => item.id === id);
    const isNavVisible = (id: string) => getNavItem(id)?.visible !== false;
    const getNavLabel = (id: string, fallback: string) => getNavItem(id)?.label?.trim() || fallback;
    const getNavOrder = (id: string, fallback: number) => Number(getNavItem(id)?.order ?? fallback);
    const menu: Array<Record<string, any>> = [];

    if (isNavVisible('home')) {
      menu.push({ id: 'home', label: getNavLabel('home', text.main), link: '/', iconName: 'home' });
    }

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');
    const activePaths = paths.filter(
      (path) =>
        (canSeeHiddenPaths || path.isActive !== false) &&
        scope.navigationPathVisible(path) &&
        path.showInNavbar !== false &&
        typeof path.id === 'string' &&
        path.id.trim().length > 0 &&
        typeof path.name === 'string' &&
        path.name.trim().length > 0
    );
    const topLevelPaths = activePaths.filter((path) => !path.parentPathId);
    const childPaths = activePaths.filter((path) => path.parentPathId);

    if (navSettings.showAutoPaths !== false) {
      topLevelPaths.forEach((path) => {
        const menuNode: Record<string, any> = {
          id: path.id,
          label: path.name,
          link: `/category/${path.id}`,
          iconName: 'book',
          children: [],
        };

        const pathLevels = levels.filter((level) => level.pathId === path.id);
        const pathSubjects = subjects.filter((subject) => subject.pathId === path.id);

        if (pathLevels.length > 0) {
          pathLevels.forEach((level) => {
            const levelSubjects = pathSubjects.filter((subject) => subject.levelId === level.id);
            menuNode.children.push({
              id: level.id,
              label: level.name,
              link: `/category/${path.id}?level=${level.id}`,
              isGroup: true,
              levelId: level.id,
              pathId: path.id,
              subjects: levelSubjects.map((subject) => ({
                id: subject.id,
                label: subject.name,
                link: `/category/${path.id}?level=${level.id}&subject=${subject.id}`,
                icon: subject.icon,
                color: subject.color,
                isChild: true,
              })),
            });
          });

          const unassignedSubjects = pathSubjects.filter(
            (subject) => !subject.levelId || !pathLevels.some((l) => l.id === subject.levelId)
          );
          if (unassignedSubjects.length > 0) {
            unassignedSubjects.forEach((subject) => {
              menuNode.children.push({
                id: subject.id,
                label: subject.name,
                link: `/category/${path.id}?subject=${subject.id}`,
                icon: subject.icon,
                color: subject.color,
              });
            });
          }
        } else {
          pathSubjects.forEach((subject) => {
            menuNode.children.push({
              id: subject.id,
              label: subject.name,
              link: `/category/${path.id}?subject=${subject.id}`,
              icon: subject.icon,
              color: subject.color,
            });
          });
        }

        const subPaths = childPaths.filter((childPath) => childPath.parentPathId === path.id);
        if (subPaths.length > 0 && menuNode.children.length > 0) {
          menuNode.children.push({ isDivider: true });
        }

        subPaths.forEach((subPath) => {
          menuNode.children.push({
            id: subPath.id,
            label: subPath.name,
            link: `/category/${subPath.id}`,
          });
        });

        if (pathSubjects.length > 0 || subPaths.length > 0 || pathLevels.length > 0) {
          if (menuNode.children.length > 0) {
            menuNode.children.push({ isDivider: true });
          }

          menuNode.children.push({
            id: `${path.id}_mock_exams`,
            label: `اختبارات محاكية ${path.name}`,
            link: `/category/${path.id}?tab=mock-exams`,
            iconName: 'award',
            isMockExam: true,
          });

          menuNode.children.push({
            id: `${path.id}_packages`,
            label: `${text.offersPrefix} ${path.name}`,
            link: `/category/${path.id}?tab=packages`,
            iconName: 'gift',
            isPackage: true,
          });
        } else {
          delete menuNode.children;
        }

        menu.push(menuNode);
      });
    }

    const mockExamPaths = topLevelPaths.filter((path) => path.settings?.showMockExamCard !== false);

    if (isNavVisible('mock-exams') && mockExamPaths.length > 0) {
      menu.push({
        id: 'mock-exams',
        label: getNavLabel('mock-exams', 'اختبارات محاكية'),
        link: '/mock-exams',
        iconName: 'award',
        children: mockExamPaths.map((path) => ({
          id: `mock-${path.id}`,
          label: path.name,
          link: `/category/${path.id}?tab=mock-exams`,
        })),
      });
    }

    const moreChildren = [
      isNavVisible('pricing') ? { id: 'pricing', label: getNavLabel('pricing', 'العضويات'), link: '/pricing', iconName: 'gift' } : null,
      isNavVisible('blog') ? { id: 'blog', label: getNavLabel('blog', text.blog), link: '/blog', iconName: 'layout-grid' } : null,
    ].filter(Boolean);

    if (moreChildren.length > 0) {
      menu.push({
        id: 'more',
        label: navSettings.moreLabel?.trim() || 'أخرى',
        link: moreChildren.length === 1 ? moreChildren[0]?.link : '#',
        iconName: 'layout-grid',
        children: moreChildren,
      });
    }

    return menu.sort((a, b) => getNavOrder(a.id, a.id === 'more' ? 100 : 50) - getNavOrder(b.id, b.id === 'more' ? 100 : 50));
}
