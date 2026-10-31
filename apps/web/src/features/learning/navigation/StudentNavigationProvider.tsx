import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { useHomepageSettings } from '../../presentation/useHomepageSettings';
import { buildStudentPathScope } from './studentPathScope';
import type { CategoryPath, CategoryLevel, CategorySubject, Preferences } from './types';
const BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const empty = (): Preferences => ({ enrolledPaths: [], pathStageSelections: [] });
type Catalog = {
    paths: CategoryPath[];
    levels: CategoryLevel[];
    subjects: CategorySubject[];
};
async function request<T>(path: string, init: RequestInit = {}): Promise<T> { const response = await fetch(BASE + path, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } }); if (!response.ok) {
    let message = 'تعذر حفظ التسجيل؛ حاول مرة أخرى.';
    try {
        message = (await response.json()).message || message;
    }
    catch { /* fallback */ }
    throw Error(message);
} return response.json(); }
type Saved = {
    user: Preferences & {
        id: string;
    };
};
const decode = (value: string) => { try {
    return decodeURIComponent(value);
}
catch {
    return value;
} };
function useNavigationState() {
    const auth = useAuth();
    const location = useLocation();
    const homepageSettings = useHomepageSettings();
    const actorId = auth.user?.id || 'guest';
    const actor = useRef(auth.user);
    actor.current = auth.user;
    const session = useRef(0);
    const previousActor = useRef(auth.user);
    if (previousActor.current !== auth.user) {
        previousActor.current = auth.user;
        session.current++;
    }
    type Resource<T> = { actorId: string; generation: number; value: T; loading: boolean; error: string };
    const [catalogResult, setCatalog] = useState<Resource<Catalog> | null>(null);
    const [saved, setSaved] = useState<Resource<Preferences> | null>(null);
    const [selection, setSelection] = useState({ actorId: '', generation: -1, pathId: '' });
    const [enrollment, setEnrollment] = useState<{actorId: string; generation: number; pathId: string} | null>(null);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const preferences = useRef(empty());
    // A confirmed write invalidates every older read in this same actor session.
    const preferenceRevision = useRef(0);
    const generation = session.current;
    const currentCatalog = catalogResult?.actorId === actorId && catalogResult.generation === generation ? catalogResult : null;
    const currentSaved = saved?.actorId === actorId && saved.generation === generation ? saved : null;
    const catalog: Catalog = currentCatalog?.value || { paths: [], levels: [], subjects: [] };
    const value = currentSaved?.value || empty();
    const catalogLoading = currentCatalog?.loading ?? true;
    const preferencesLoading = auth.loading || Boolean(auth.user && (!currentSaved || currentSaved.loading));
    const catalogError = currentCatalog?.error || '';
    const preferencesError = auth.user ? currentSaved?.error || '' : '';
    const loading = auth.loading || catalogLoading || preferencesLoading;
    const error = catalogError || preferencesError;
    preferences.current = value;

    useEffect(() => {
        let disposed = false;
        let revision = 0;
        let controller: AbortController | null = null;
        const captured = actor.current;
        const load = () => {
            controller?.abort();
            controller = new AbortController();
            const requestController = controller;
            const started = ++revision;
            setCatalog(previous => ({actorId, generation, value: previous?.actorId === actorId && previous.generation === generation ? previous.value : {paths: [], levels: [], subjects: []}, loading: true, error: ''}));
            const current = () => !disposed && !requestController.signal.aborted && started === revision && session.current === generation && actor.current === captured;
            void request<Catalog>('/api/v1/taxonomy/bootstrap?phase=core', {signal: requestController.signal}).then(data => {
                if (!Array.isArray(data.paths) || !Array.isArray(data.subjects)) throw Error('Invalid catalog');
                const safeData = {
                    paths: data.paths,
                    levels: Array.isArray(data.levels) ? data.levels : [],
                    subjects: data.subjects,
                };
                if (current()) setCatalog({actorId, generation, value: safeData, loading: false, error: ''});
            }).catch(() => {
                if (current()) setCatalog(previous => ({actorId, generation, value: previous?.actorId === actorId && previous.generation === generation ? previous.value : {paths: [], levels: [], subjects: []}, loading: false, error: 'تعذر تحميل المسارات.'}));
            });
        };
        load();
        window.addEventListener('almeaa:taxonomy-updated', load);
        return () => { disposed = true; controller?.abort(); window.removeEventListener('almeaa:taxonomy-updated', load); };
    }, [actorId, generation]);

    // Catalog refreshes never refetch or replace learner preference records.
    useEffect(() => {
        const controller = new AbortController();
        const captured = actor.current;
        const revision = preferenceRevision.current;
        const current = () => !controller.signal.aborted && session.current === generation && actor.current === captured && preferenceRevision.current === revision;
        if (!auth.user) {
            setSaved(null);
            return () => controller.abort();
        }
        setSaved({actorId, generation, value: empty(), loading: true, error: ''});
        void request<Saved>('/api/v1/learning/navigation-preferences', {signal: controller.signal}).then(result => {
            if (!result?.user || result.user.id !== actorId || !Array.isArray(result.user.enrolledPaths) || !Array.isArray(result.user.pathStageSelections)) throw Error('Invalid preferences');
            if (current()) setSaved({actorId, generation, value: result.user, loading: false, error: ''});
        }).catch(() => {
            if (current()) setSaved({actorId, generation, value: empty(), loading: false, error: 'تعذر تحميل تسجيل المسارات.'});
        });
        return () => controller.abort();
    }, [actorId, generation]);
    useEffect(() => { setSelection({ actorId, generation, pathId: '' }); }, [homepageSettings.studentExperience?.visibilityMode, actorId, generation]);
    const routePathId = location.pathname.startsWith('/category/') ? decode(location.pathname.split('/')[2] || '') : '';
    const selectedPathId = selection.actorId === actorId && selection.generation === generation ? selection.pathId : '';
    const effectivePathId = routePathId ? (value.enrolledPaths.includes(routePathId) ? routePathId : '') : selectedPathId;
    const user = auth.user || { id: 'guest', role: 'guest', name: '', email: '' };
    const scope = useMemo(() => buildStudentPathScope({ user, ...catalog, ...value, visibilityMode: homepageSettings.studentExperience?.visibilityMode || 'all', activePathId: effectivePathId }), [auth.user, catalog, value, homepageSettings.studentExperience?.visibilityMode, effectivePathId]);
    const changePath = (pathId: string, levelId?: string, remove = false) => {
        const captured = actor.current;
        const started = session.current;
        if (loading || error)
            return Promise.reject(Error(error || 'جارٍ تحميل تسجيل المسارات؛ حاول مرة أخرى.'));
        const operation = queue.current.catch(() => undefined).then(async () => {
            if (actor.current !== captured || session.current !== started)
                throw Error('تغيّر الحساب؛ أعد المحاولة من جلستك الحالية.');
            const current = preferences.current;
            if (!remove && current.enrolledPaths.includes(pathId) && (!levelId || current.pathStageSelections.some(row => row.pathId === pathId && row.levelId === levelId)))
                return;
            const next: Preferences = { enrolledPaths: remove ? current.enrolledPaths.filter(id => id !== pathId) : [...new Set([...current.enrolledPaths, pathId])], pathStageSelections: remove || levelId ? [...current.pathStageSelections.filter(row => row.pathId !== pathId), ...(!remove && levelId ? [{ pathId, levelId }] : [])] : current.pathStageSelections };
            const csrf = await auth.getCsrfToken();
            if (actor.current !== captured || session.current !== started)
                throw Error('تغيّر الحساب؛ أعد المحاولة من جلستك الحالية.');
            const result = await request<Saved>('/api/v1/learning/navigation-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(next) });
            if (actor.current !== captured || session.current !== started)
                throw Error('تغيّر الحساب؛ أعد المحاولة من جلستك الحالية.');
            if (result.user.id !== captured?.id || !Array.isArray(result.user.enrolledPaths) || (remove ? result.user.enrolledPaths.includes(pathId) : !result.user.enrolledPaths.includes(pathId)) || (!remove && levelId && !result.user.pathStageSelections?.some(row => row.pathId === pathId && row.levelId === levelId)))
                throw Error('تعذر تأكيد حفظ تسجيل المسار؛ حاول مرة أخرى.');
            const confirmed: Preferences = { enrolledPaths: result.user.enrolledPaths, pathStageSelections: result.user.pathStageSelections || [] };
            preferenceRevision.current++;
            preferences.current = confirmed;
            setSaved({ actorId, generation: started, value: confirmed, loading: false, error: '' });
        });
        queue.current = operation;
        return operation;
    };
    return { ...catalog, ...value, user, homepageSettings, scope, selectedPathId: scope.activePathId, selectPath: (pathId: string) => setSelection({ actorId, generation, pathId }), enrollmentOpen: enrollment?.actorId === actorId && enrollment.generation === generation && scope.isStudent, enrollmentPathId: enrollment?.actorId === actorId && enrollment.generation === generation ? enrollment.pathId : '', openEnrollment: (pathId = '') => setEnrollment({ actorId, generation, pathId }), closeEnrollment: () => setEnrollment(null), enrollPath: (pathId: string, levelId?: string) => changePath(pathId, levelId), unenrollPath: (pathId: string) => changePath(pathId, undefined, true), isCurrentActor: (id: string) => actor.current?.id === id && session.current === generation, loading, error, catalogLoading, preferencesLoading, catalogError, preferencesError };
}
const Context = createContext<ReturnType<typeof useNavigationState> | null>(null);
export function StudentNavigationProvider({ children }: {
    children: React.ReactNode;
}) { const state = useNavigationState(); return <Context.Provider value={state}>{children}</Context.Provider>; }
export const StudentExperienceProvider = StudentNavigationProvider;
export function useStudentExperience() { const value = useContext(Context); if (!value)
    throw Error('StudentNavigationProvider is required'); return value; }
