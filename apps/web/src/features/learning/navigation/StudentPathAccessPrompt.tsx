import React from 'react';
import type { CategoryPath } from './types';
import { useStudentExperience } from './StudentNavigationProvider';
export const StudentPathAccessPrompt = ({ path }: { path?: CategoryPath }) => {
    const { openEnrollment } = useStudentExperience();
    return <section className="max-w-2xl mx-auto my-10 p-6 rounded-3xl border bg-indigo-50 text-center" dir="rtl"><h1 className="text-xl font-black">هذا المحتوى خارج مسارك أو مرحلتك الحالية</h1><p className="text-slate-600 my-4">اختر المسار والمرحلة المناسبين لعرض محتواهما. تسجيل المسار لا يغيّر اشتراكك أو نتائجك السابقة.</p><button onClick={() => openEnrollment(path?.id)} className="rounded-xl bg-indigo-600 text-white font-bold px-6 py-3">{path ? 'اختيار المسار أو المرحلة: '+path.name : 'اختيار المسار'}</button></section>;
};
