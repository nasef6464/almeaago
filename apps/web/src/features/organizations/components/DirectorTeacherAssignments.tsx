import type { TaxonomySubject } from '../../content/api/content-types';
import type { DirectorAssignment, SchoolClass } from '../api/organizations-client';

type AssignmentStop = Pick<DirectorAssignment, 'teacherId' | 'classId' | 'subjectId'> & { status: 'inactive' };

interface Props {
  teacherId: string;
  assignments: DirectorAssignment[];
  classes: SchoolClass[];
  subjects: TaxonomySubject[];
  busy: boolean;
  onDeactivate: (assignment: AssignmentStop) => void;
}

export function DirectorTeacherAssignments({ teacherId, assignments, classes, subjects, busy, onDeactivate }: Props) {
  const active = assignments.filter(row => row.teacherId === teacherId && row.status === 'active');
  const materials = new Set(active.map(row => row.subjectId).filter(Boolean));

  return <section aria-label="تكليفات المعلم الحالية" className="mt-4 border-t border-emerald-100 pt-4">
    <h3 className="text-sm font-black text-slate-900">تكليفات المعلم الحالية</h3>
    {!teacherId ? <p className="mt-2 text-xs text-slate-500">اختر المعلم لعرض مادته وفصوله.</p> : <>
      {(active.some(row => !row.subjectId) || materials.size > 1) && <p role="alert" className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-900">يلزم توحيد التكليفات على مادة واحدة. أوقف التكليف غير المحدد أو المتعارض ثم أضف التكليف الصحيح.</p>}
      <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
        {active.map(row => <li key={row.assignmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3 text-xs">
          <span className="font-bold text-slate-800">{classes.find(item => item.id === row.classId)?.name || 'فصل مسجل'} · {subjects.find(item => item.id === row.subjectId)?.name || (row.subjectId ? 'مادة مسجلة' : 'مادة غير محددة')}</span>
          <button type="button" disabled={busy} onClick={() => onDeactivate({ teacherId: row.teacherId, classId: row.classId, subjectId: row.subjectId, status: 'inactive' })} className="min-h-10 rounded-xl border border-rose-200 bg-white px-3 font-black text-rose-700 disabled:opacity-40">إيقاف التكليف</button>
        </li>)}
      </ul>
      {active.length === 0 && <p className="mt-2 text-xs text-slate-500">لا توجد تكليفات فعالة لهذا المعلم.</p>}
    </>}
  </section>;
}
