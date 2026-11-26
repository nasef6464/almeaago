import { organizationsClient, OrganizationsApiError } from '../api/organizations-client';
import type { ImportRow } from './importRowParsing';

export interface DirectorImportFailure {
  row: ImportRow;
  message: string;
}

function rowError(error: unknown, fallback: string) {
  if (!(error instanceof OrganizationsApiError)) return fallback;
  switch (error.status) {
    case 400: return 'راجع بيانات الصف والفصل وكلمة المرور.';
    case 401: return 'انتهت الجلسة. سجّل الدخول مجددًا.';
    case 403: return 'الصلاحية المطلوبة لهذا الإجراء غير متاحة.';
    case 404: return 'الفصل المطلوب غير موجود أو غير نشط.';
    case 409: return 'يوجد تعارض في الحساب أو الفصل. راجع كشف المدرسة.';
    default: return fallback;
  }
}

export async function importDirectorRoster(schoolId: string, rows: ImportRow[], csrf: string, isCurrent: () => boolean) {
  const credentials: { name: string; email: string; className: string; password: string }[] = [];
  const failures: DirectorImportFailure[] = [];
  const classIds = new Set<string>();
  let linked = 0;
  const classrooms = new Map<string, string>();
  for (let page = 1; isCurrent(); page++) {
    const result = await organizationsClient.classes(schoolId, undefined, page);
    for (const classroom of result.classes) classrooms.set(classroom.name.trim(), classroom.id);
    if (page >= result.pagination.totalPages) break;
  }

  const failedClassNames = new Map<string, string>();
  for (const row of rows) {
    if (!isCurrent()) break;
    const className = row.className?.trim();
    if (!className) {
      failures.push({ row, message: 'أضف اسم الفصل في الكشف.' });
      continue;
    }
    let classId = classrooms.get(className);
    if (!classId) {
      const failedEarlier = failedClassNames.get(className);
      if (failedEarlier) {
        failures.push({ row, message: failedEarlier });
        continue;
      }
      try {
        const { classroom } = await organizationsClient.createDirectorClass(schoolId, className, csrf);
        if (!classroom?.classId) throw new Error('Missing classroom confirmation');
        classId = classroom.classId;
        classrooms.set(className, classId);
      } catch (error) {
        const message = `تعذر تأكيد إنشاء الفصل. ${rowError(error, 'أعد المحاولة.')}`;
        failedClassNames.set(className, message);
        failures.push({ row, message });
        continue;
      }
    }
    if (!isCurrent()) break;
    const password = row.password?.trim() || `Noor@${crypto.randomUUID()}`;
    try {
      const { student, created } = await organizationsClient.addDirectorStudent(schoolId, {
        name: row.name, email: row.email, password, classId,
      }, csrf);
      if (!student?.studentId || !student.isActive || student.classId !== classId ||
        student.email?.toLowerCase() !== row.email.toLowerCase() || typeof created !== 'boolean') {
        throw new Error('Missing enrollment confirmation');
      }
      classIds.add(classId);
      if (created) credentials.push({ name: student.name, email: student.email, className, password });
      else linked++;
    } catch (error) {
      failures.push({ row, message: rowError(error, 'تعذر تأكيد حفظ الطالب. أعد المحاولة.') });
    }
  }
  return { credentials, failures, linked, classIds };
}
