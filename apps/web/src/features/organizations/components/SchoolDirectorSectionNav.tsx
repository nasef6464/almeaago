import { ChevronLeft } from 'lucide-react';

import type { SchoolContext } from '../api/organizations-client';

export type DirectorSectionID = 'overview' | 'students' | 'classes' | 'teachers' | 'assessments';
type DirectorNavigationItem = { id: DirectorSectionID; label: string };

// The four working sections retain their identifiers, order, and group names
// from the Node directorNavigation contract. Unsupported modules remain absent
// until their real Go API and entitlement checks have been migrated.
export const directorSectionGroups: { label: string; ids: DirectorSectionID[] }[] = [
  { label: 'البداية', ids: ['overview'] },
  { label: 'إدارة المدرسة', ids: ['students', 'classes', 'teachers'] },
  { label: 'التعلم والمتابعة', ids: ['assessments'] },
];

export function directorNavItems(school: SchoolContext): DirectorNavigationItem[] {
  const has = (permission: string, module?: string) =>
    school.permissions.includes(permission) && (!module || school.modules.includes(module));
  return [
    { id: 'overview', label: 'الملخص العام', visible: has('SCHOOL_OVERVIEW_VIEW') },
    { id: 'students', label: 'الطلاب', visible: has('SCHOOL_STUDENTS_VIEW') },
    { id: 'classes', label: 'الفصول', visible: has('SCHOOL_CLASSES_MANAGE', 'SCHOOL_CORE') },
    { id: 'teachers', label: 'المعلمون والتكليفات', visible: has('SCHOOL_TEACHERS_ASSIGN', 'SCHOOL_CORE') },
    { id: 'assessments', label: 'اختبارات المدرسة', visible: has('SCHOOL_ASSESSMENTS_MANAGE', 'SCHOOL_ASSESSMENTS') },
  ].filter(item => item.visible).map(({ id, label }) => ({ id: id as DirectorSectionID, label }));
}

export function SchoolDirectorSectionNav({
  items, active, onSelect,
}: { items: DirectorNavigationItem[]; active: DirectorSectionID; onSelect: (id: DirectorSectionID) => void }) {
  return <nav aria-label="أقسام لوحة مدير المدرسة" dir="rtl" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
    {directorSectionGroups.map(group => {
      const entries = group.ids.map(id => items.find(item => item.id === id)).filter((item): item is DirectorNavigationItem => Boolean(item));
      if (!entries.length) return null;
      return <section key={group.label} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
        <h2 className="px-2 pb-2 pt-1 text-xs font-black text-slate-500">{group.label}</h2>
        <div className="grid gap-2">
          {entries.map(item => <button key={item.id} type="button" aria-current={item.id === active ? 'page' : undefined} onClick={() => onSelect(item.id)}
            className={`min-h-11 w-full rounded-xl border px-3 py-3 text-right text-sm font-bold transition-colors ${item.id === active ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'}`}>
            {item.label}
          </button>)}
        </div>
      </section>;
    })}
  </nav>;
}

export function SchoolDirectorBreadcrumb({items,active,onHome}:{items:DirectorNavigationItem[];active:DirectorSectionID;onHome:()=>void}){
  const current=items.find(item=>item.id===active);
  const group=directorSectionGroups.find(item=>item.ids.includes(active));
  return <nav aria-label="مسار الصفحة" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500" dir="rtl">
    <button type="button" onClick={onHome} className="min-h-11 rounded-lg px-1 font-bold text-indigo-700 hover:underline">لوحة مدير المدرسة</button>
    {group && group.ids.length>1?<><ChevronLeft aria-hidden="true" size={12}/><span>{group.label}</span></>:null}
    {current?<><ChevronLeft aria-hidden="true" size={12}/><span aria-current="page" className="font-bold text-slate-800">{current.label}</span></>:null}
  </nav>;
}
