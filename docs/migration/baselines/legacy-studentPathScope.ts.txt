import type { CategoryPath, CategoryLevel, CategorySubject, PathStageSelection } from '../types';
type ScopeUser = { id?: string; email?: string; role?: string };
type ContentRef = { pathId?: string; category?: string; subjectId?: string; subject?: string; levelId?: string | null };
export const resolveStageRequirement = (path: CategoryPath, levels: CategoryLevel[]) => {
    const available = levels.filter(level => level.pathId === path.id);
    const choice = path.settings?.stageSelection;
    const policy = choice === 'required' || choice === 'none' ? choice : 'auto';
    return { requiresStage: policy === 'required' || (policy === 'auto' && available.length > 0), levels: available, label: (typeof path.settings?.stageLabel === 'string' ? path.settings.stageLabel.trim() : '') || 'اختر مرحلتك' };
};
export const buildStudentPathScope = (input: {
    user?: ScopeUser; paths: CategoryPath[]; levels: CategoryLevel[]; subjects: CategorySubject[];
    enrolledPaths?: string[]; pathStageSelections?: PathStageSelection[]; visibilityMode?: 'all' | 'enrolled'; activePathId?: string;
}) => {
    const { user, paths, levels, subjects } = input;
    const isStudent = Boolean(user?.id && user.id !== 'guest' && user.role === 'student');
    const registeredPaths = paths.filter(path => path.isActive !== false && input.enrolledPaths?.includes(path.id));
    const restricted = isStudent && input.visibilityMode === 'enrolled' && registeredPaths.length > 0;
    const activePathId = isStudent && registeredPaths.some(path => path.id === input.activePathId) ? input.activePathId! : '';
    const enrolledIds = new Set(registeredPaths.map(path => path.id));
    const contentIds = new Set(activePathId ? [activePathId] : registeredPaths.map(path => path.id));
    const expandChildren = (ids: Set<string>) => {
        let changed = true;
        while (changed) { changed = false; for (const path of paths) if (path.parentPathId && ids.has(path.parentPathId) && !ids.has(path.id)) { ids.add(path.id); changed = true; } }
        return ids;
    };
    expandChildren(enrolledIds); expandChildren(contentIds);
    const navIds = new Set(enrolledIds);
    for (const id of enrolledIds) { let parent = paths.find(path => path.id === id)?.parentPathId; const visited = new Set<string>(); while (parent && !visited.has(parent)) { visited.add(parent); navIds.add(parent); parent = paths.find(path => path.id === parent)?.parentPathId; } }
    const pathIdByName = new Map(paths.flatMap(path => [[path.id.toLowerCase(), path.id], [String(path.name || '').trim().toLowerCase(), path.id]] as [string, string][]).filter(([key]) => Boolean(key)));
    const subjectById = new Map(subjects.map(subject => [subject.id, subject]));
    const resolvePathId = (value?: string) => {
        const normalized = String(value || '').trim().toLowerCase();
        return pathIdByName.get(normalized) || value || '';
    };
    const stageByPath = new Map<string, string>();
    if (isStudent) for (const row of input.pathStageSelections || []) if (enrolledIds.has(row.pathId) && paths.find(path => path.id === row.pathId)?.settings?.stageSelection !== 'none' && levels.some(level => level.id === row.levelId && level.pathId === row.pathId)) stageByPath.set(row.pathId, row.levelId);
    const pathVisible = (path: { id: string }) => (!restricted && !activePathId) || contentIds.has(path.id);
    const navigationPathVisible = (path: { id: string }) => !restricted || navIds.has(path.id);
    const resolveContentPathId = (item: ContentRef) => {
        const subject = subjectById.get(item.subjectId || item.subject || '');
        const explicit = resolvePathId(item.pathId);
        const category = resolvePathId(item.category);
        return (pathIdByName.has(String(item.pathId || '').trim().toLowerCase()) ? explicit : '') || subject?.pathId || (pathIdByName.has(String(item.category || '').trim().toLowerCase()) ? category : '') || item.pathId || '';
    };
    const matches = (item: ContentRef, navigation: boolean) => {
        const subject = subjectById.get(item.subjectId || item.subject || '');
        const pathId = resolveContentPathId(item);
        if (pathId && !(navigation ? navigationPathVisible({ id: pathId }) : pathVisible({ id: pathId }))) return false;
        const levelId = item.levelId || subject?.levelId;
        const stage = stageByPath.get(pathId);
        return !stage || !levelId || levelId === stage;
    };
    const matchesContent = (item: ContentRef) => matches(item, false);
    const matchesNavigationContent = (item: ContentRef) => matches(item, true);
    const templatePath = paths.find(path => path.id === (activePathId || (registeredPaths.length === 1 ? registeredPaths[0].id : '')));
    return { isStudent, restricted, registeredPaths, stageByPath, activePathId, pathVisible, navigationPathVisible, matchesContent, matchesNavigationContent, resolveContentPathId, template: isStudent && templatePath?.settings?.studentTemplate === 'simple' ? 'simple' as const : 'standard' as const };
};
