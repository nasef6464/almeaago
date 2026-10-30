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

// Presentation matches Legacy dashboards/school-director/DirectorTeacherAssignments.tsx.
// Only the DTO field adapters (classId/name vs id/name) differ.
export function DirectorTeacherAssignments({ teacherId, assignments, classes, subjects, busy, onDeactivate }: Props) {
  const rows = assignments.filter(a => a.teacherId === teacherId && a.status === 'active');
  const materials = new Set(rows.map(a => a.subjectId).filter(Boolean));

  return <section aria-label="تكليفات المعلم الحالية" className="mt-4 border-t border-emerald-100 pt-3">
    <h4 className="text-sm font-bold">تكليفات المعلم الحالية</h4>
    {!teacherId ? <p className="mt-2 text-xs text-slate-500">اختر المعلم لعرض مادته وفصوله.</p> : <>
      {(rows.some(a => !a.subjectId) || materials.size > 1) && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">يلزم توحيد التكليفات على مادة واحدة. أوقف التكليف غير المحدد أو المتعارض ثم أضف التكليف الصحيح.</p>}
      <ul className="mt-2 max-h-72 space-y-2 overflow-auto">
        {rows.map(a => <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 text-xs">
          <span>{classes.find(c => c.id === a.classId)?.name || 'فصل مسجل'} · {subjects.find(s => s.id === a.subjectId)?.name || (a.subjectId ? 'مادة مسجلة' : 'مادة غير محددة')}</span>
          <button type="button" disabled={busy} onClick={() => onDeactivate({ teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId, status: 'inactive' })} className="min-h-10 rounded-lg border border-rose-200 px-3 font-bold text-rose-700 disabled:opacity-40">إيقاف التكليف</button>
        </li>)}
      </ul>
      {!rows.length && <p className="mt-2 text-xs text-slate-500">لا توجد تكليفات فعالة لهذا المعلم.</p>}
    </>}
  </section>;
}
