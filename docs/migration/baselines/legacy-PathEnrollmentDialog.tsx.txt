import { useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useStudentExperience } from '../../contexts/StudentExperienceContext';
import { resolveStageRequirement } from '../../utils/studentPathScope';
export const PathEnrollmentDialog = ({ onComplete }: { onComplete?: (name: string) => void }) => {
    const { enrollmentOpen, enrollmentPathId, closeEnrollment, selectPath } = useStudentExperience();
    const navigate = useNavigate(); const location = useLocation();
    const { paths, levels, pathStageSelections, enrollPath, user } = useStore();
    const [pathId, setPathId] = useState('');
    const [levelId, setLevelId] = useState('');
    const requestGeneration = useRef(0);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const visiblePaths = paths.filter(path => path.isActive !== false && (path.showInHome !== false || path.showInNavbar !== false));
    const path = visiblePaths.find(item => item.id === pathId);
    const stages = path ? resolveStageRequirement(path, levels) : null;
    useEffect(() => {
        requestGeneration.current += 1; setPending(false);
        if (!enrollmentOpen) return;
        setPathId(enrollmentPathId); setLevelId((pathStageSelections || []).find(row => row.pathId === enrollmentPathId)?.levelId || ''); setError('');
    }, [enrollmentOpen, enrollmentPathId, user.id]);
    if (!enrollmentOpen) return null;
    return <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4" dir="rtl">
        <section role="dialog" aria-modal="true" aria-labelledby="path-enrollment-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center gap-3 mb-4"><h2 id="path-enrollment-title" className="font-black text-xl">اختر مسارك التعليمي</h2><button type="button" disabled={pending} onClick={closeEnrollment} aria-label="إغلاق اختيار المسار" className="px-3 py-2 rounded-xl bg-slate-100">إغلاق</button></div>
            <p className="text-sm text-slate-600 mb-5">يمكنك التسجيل في أكثر من مسار. تسجيل المسار يرتّب تعلمك ولا يفتح المحتوى المدفوع تلقائيًا.</p>
            <form onSubmit={async event => {
                event.preventDefault(); if (!path || pending) return;
                if (stages?.requiresStage && !stages.levels.some(level => level.id === levelId)) { setError(stages.levels.length ? 'اختر مرحلة صحيحة لهذا المسار.' : 'هذا المسار يحتاج إضافة مراحل قبل التسجيل.'); return; }
                const actorId = user.id; const generation = ++requestGeneration.current; setPending(true); setError('');
                try { await enrollPath(path.id, stages?.requiresStage ? levelId : undefined); if (useStore.getState().user.id !== actorId || requestGeneration.current !== generation) return; selectPath(path.id); onComplete?.(path.name); closeEnrollment(); if (location.pathname.startsWith('/category/') && location.pathname.split('/')[2] !== path.id) navigate('/category/'+encodeURIComponent(path.id)); }
                catch (failure) { if (useStore.getState().user.id === actorId && requestGeneration.current === generation) setError(failure instanceof Error ? failure.message : 'تعذر حفظ التسجيل؛ حاول مرة أخرى.'); }
                finally { if (requestGeneration.current === generation) setPending(false); }
            }} className="space-y-4">
                <label className="block font-bold">المسار التعليمي<select aria-label="المسار التعليمي" required disabled={pending} value={pathId} onChange={event => { const next = event.target.value; setPathId(next); setLevelId((pathStageSelections || []).find(row => row.pathId === next)?.levelId || ''); setError(''); }} className="mt-2 w-full rounded-xl border p-3"><option value="">اختر مسارًا</option>{visiblePaths.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                {stages?.requiresStage && <label className="block font-bold">{stages.label}<select aria-label={stages.label} required disabled={pending || stages.levels.length === 0} value={levelId} onChange={event => setLevelId(event.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">اختر المرحلة</option>{stages.levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}</select>{stages.levels.length === 0 && <p role="status" className="text-sm text-amber-800 mt-2">سيُتاح التسجيل بعد إضافة مراحل لهذا المسار.</p>}</label>}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={!path || pending || (stages?.requiresStage && !stages.levels.length)} className="w-full min-h-12 rounded-xl bg-indigo-600 text-white font-bold disabled:bg-slate-300">{pending ? 'جارٍ حفظ التسجيل...' : 'تأكيد التسجيل'}</button>
            </form>
        </section>
    </div>;
};
