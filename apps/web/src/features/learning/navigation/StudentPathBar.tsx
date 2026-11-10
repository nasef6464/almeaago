import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { useStudentExperience } from './StudentNavigationProvider';
import { resolveStageRequirement } from './studentPathScope';
import { PathEnrollmentDialog } from './PathEnrollmentDialog';

export const StudentPathBar = () => {
    const { scope, homepageSettings, selectedPathId, selectPath, openEnrollment } = useStudentExperience();
    const navigate = useNavigate(); const location = useLocation();
    const { levels } = useStudentExperience();
    const [notice, setNotice] = useState('');
    if (!scope.isStudent) return null;
    const missingStage = scope.registeredPaths.find(path => resolveStageRequirement(path, levels).requiresStage && !scope.stageByPath.has(path.id));
    const showPrompt = homepageSettings?.studentExperience?.promptEnrollment !== false && !scope.registeredPaths.length;
    return <>
        <aside className="border-b border-indigo-100 dark:border-slate-800 bg-indigo-50 dark:bg-slate-900 px-4 py-3 transition-colors" aria-label="مسارات تعلمي" dir="rtl">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 text-sm">
                {showPrompt && <p className="font-bold flex-1 text-indigo-950 dark:text-slate-100">سجّل في مسارك لنرتّب محتواك ونتابع تقدمك.</p>}
                {scope.registeredPaths.length > 0 && <label className="flex items-center gap-2 font-bold min-w-0 max-w-full text-indigo-950 dark:text-slate-100">مساري الحالي<select aria-label="مساري الحالي" value={selectedPathId} onChange={event => { const id = event.target.value; selectPath(id); if (location.pathname.startsWith('/category/')) navigate(id ? '/category/'+encodeURIComponent(id) : '/dashboard'); }} className="rounded-xl border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 min-w-0 max-w-full text-gray-900 dark:text-gray-100"><option value="">{scope.restricted ? 'كل مساراتي' : 'كل المسارات'}</option>{scope.registeredPaths.map(path => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label>}
                {missingStage && <button className="rounded-xl bg-amber-100 dark:bg-amber-900/60 px-4 py-2 font-bold text-amber-900 dark:text-amber-200" onClick={() => openEnrollment(missingStage.id)}>اختر مرحلتك في {missingStage.name}</button>}
                <button onClick={() => openEnrollment()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 min-h-11 text-white font-bold transition shadow-xs">{scope.registeredPaths.length ? 'إضافة مسار أو تغيير المرحلة' : 'اختيار المسار'}</button>
                {notice && <p role="status" className="text-emerald-800 dark:text-emerald-300 font-bold">{notice}</p>}
            </div>
        </aside>
        <PathEnrollmentDialog onComplete={name => setNotice('تم حفظ تسجيلك في '+name)} />
    </>;
};

export const PathEnrollmentButton = ({ pathId, children }: { pathId: string; children?: React.ReactNode }) => {
    const { openEnrollment } = useStudentExperience();
    return <button data-testid="student-path-enroll" onClick={() => openEnrollment(pathId)} className="w-full rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 py-3 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition">{children || 'تسجيل في المسار'}</button>;
};
