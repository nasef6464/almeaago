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
        <aside className="border-b border-indigo-100 bg-indigo-50 px-4 py-3" aria-label="مسارات تعلمي" dir="rtl">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 text-sm">
                {showPrompt && <p className="font-bold flex-1">سجّل في مسارك لنرتّب محتواك ونتابع تقدمك.</p>}
                {scope.registeredPaths.length > 0 && <label className="flex items-center gap-2 font-bold min-w-0 max-w-full">مساري الحالي<select aria-label="مساري الحالي" value={selectedPathId} onChange={event => { const id = event.target.value; selectPath(id); if (location.pathname.startsWith('/category/')) navigate(id ? '/category/'+encodeURIComponent(id) : '/dashboard'); }} className="rounded-xl border bg-white px-3 py-2 min-w-0 max-w-full"><option value="">{scope.restricted ? 'كل مساراتي' : 'كل المسارات'}</option>{scope.registeredPaths.map(path => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label>}
                {missingStage && <button className="rounded-xl bg-amber-100 px-4 py-2 font-bold text-amber-900" onClick={() => openEnrollment(missingStage.id)}>اختر مرحلتك في {missingStage.name}</button>}
                <button onClick={() => openEnrollment()} className="rounded-xl bg-indigo-600 px-4 py-2 min-h-11 text-white font-bold">{scope.registeredPaths.length ? 'إضافة مسار أو تغيير المرحلة' : 'اختيار المسار'}</button>
                {notice && <p role="status" className="text-emerald-800">{notice}</p>}
            </div>
        </aside>
        <PathEnrollmentDialog onComplete={name => setNotice('تم حفظ تسجيلك في '+name)} />
    </>;
};
export const PathEnrollmentButton = ({ pathId, children }: { pathId: string; children?: React.ReactNode }) => {
    const { openEnrollment } = useStudentExperience();
    return <button data-testid="student-path-enroll" onClick={() => openEnrollment(pathId)} className="w-full rounded-xl bg-indigo-50 text-indigo-700 py-3 font-bold hover:bg-indigo-100">{children || 'تسجيل في المسار'}</button>;
};
