import { useEffect, useState } from 'react';

import type {
  AdminTaxonomyPath,
  AdminTaxonomySubject,
  PathDisplayInput,
  SubjectDisplayInput,
} from '../api/taxonomy-admin-client';

type Props = {
  path: AdminTaxonomyPath;
  levelCount: number;
  subject: AdminTaxonomySubject | null;
  pending: string;
  savePath: (input: PathDisplayInput) => Promise<boolean>;
  saveSubject: (input: SubjectDisplayInput) => Promise<boolean>;
};

export function TaxonomyDisplayEditor({ path, levelCount, subject, pending, savePath, saveSubject }: Props) {
  const [showInNavbar, setShowInNavbar] = useState(path.showInNavbar !== false);
  const [showInHome, setShowInHome] = useState(path.showInHome !== false);
  const [showSubjectCards, setShowSubjectCards] = useState(path.settings?.showSubjectCards !== false);
  const [showMockExamCard, setShowMockExamCard] = useState(path.settings?.showMockExamCard !== false);
  const [showPackageCard, setShowPackageCard] = useState(path.settings?.showPackageCard !== false);
  const [studentTemplate, setStudentTemplate] = useState(path.settings?.studentTemplate ?? 'standard');
  const [stageSelection, setStageSelection] = useState(path.settings?.stageSelection ?? 'auto');
  const [stageLabel, setStageLabel] = useState(path.settings?.stageLabel ?? 'اختر مرحلتك');
  const [icon, setIcon] = useState(subject?.icon ?? '');
  const [color, setColor] = useState(subject?.color ?? '');

  useEffect(() => {
    setShowInNavbar(path.showInNavbar !== false);
    setShowInHome(path.showInHome !== false);
    setShowSubjectCards(path.settings?.showSubjectCards !== false);
    setShowMockExamCard(path.settings?.showMockExamCard !== false);
    setShowPackageCard(path.settings?.showPackageCard !== false);
    setStudentTemplate(path.settings?.studentTemplate ?? 'standard');
    setStageSelection(path.settings?.stageSelection ?? 'auto');
    setStageLabel(path.settings?.stageLabel ?? 'اختر مرحلتك');
  }, [path.id, path.showInNavbar, path.showInHome, path.settings?.showSubjectCards, path.settings?.showMockExamCard, path.settings?.showPackageCard, path.settings?.studentTemplate, path.settings?.stageSelection, path.settings?.stageLabel]);

  useEffect(() => {
    setIcon(subject?.icon ?? '');
    setColor(subject?.color ?? '');
  }, [subject?.id, subject?.icon, subject?.color]);

  return (
    <section data-testid="taxonomy-display-editor" className="mt-4 space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <fieldset disabled={pending === 'display-path'} className="min-w-0 space-y-4">
        <div>
          <p className="text-xs font-black text-indigo-700">عرض المسار</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold">
            <input aria-label="إظهار هذا المسار في القائمة العلوية الرئيسة" type="checkbox" checked={showInNavbar} onChange={event => setShowInNavbar(event.target.checked)} />
            إظهار هذا المسار في القائمة العلوية الرئيسة
          </label>
          <label className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold">
            <input aria-label="إظهار المسار في الصفحة الرئيسية" type="checkbox" checked={showInHome} onChange={event => setShowInHome(event.target.checked)} />
            إظهار المسار في الصفحة الرئيسية
          </label>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 sm:col-span-2">
            <p className="mb-3 text-sm font-black text-indigo-800">بطاقات صفحة المسار</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700">
                <input aria-label="المواد" type="checkbox" checked={showSubjectCards} onChange={event => setShowSubjectCards(event.target.checked)} />
                المواد
              </label>
              <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700">
                <input aria-label="الاختبارات التجريبية" type="checkbox" checked={showMockExamCard} onChange={event => setShowMockExamCard(event.target.checked)} />
                الاختبارات التجريبية
              </label>
              <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700">
                <input aria-label="الباقات" type="checkbox" checked={showPackageCard} onChange={event => setShowPackageCard(event.target.checked)} />
                الباقات
              </label>
            </div>
          </div>
        </div>
        </div>

        <fieldset className="space-y-4 rounded-2xl border border-gray-100 p-4">
          <legend className="px-2 font-bold">تجربة الطالب في المسار</legend>
          <label className="block font-bold">اختيار المرحلة
            <select aria-label="اختيار المرحلة" value={stageSelection} onChange={event => setStageSelection(event.target.value as 'auto'|'required'|'none')} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold">
              <option value="auto">تلقائي حسب المراحل المضافة</option>
              <option value="required">اختيار مرحلة مطلوب</option>
              <option value="none">بدون اختيار مرحلة</option>
            </select>
          </label>
          <p className="text-sm text-gray-500">التلقائي يطلب الاختيار عند وجود مراحل. بدون اختيار مرحلة يسمح بالتسجيل مباشرة ويحافظ على المراحل والمحتوى الموجود.</p>
          {stageSelection === 'required' && levelCount === 0 ? (
            <p role="status" className="text-sm text-amber-700">أضف مرحلة قبل إتاحة تسجيل الطلاب. يمكنك حفظ الإعداد ثم إضافة المراحل من تبويب المراحل.</p>
          ) : null}
          <label className="block font-bold">سؤال اختيار المرحلة
            <input aria-label="سؤال اختيار المرحلة" disabled={stageSelection === 'none'} value={stageLabel} onChange={event => setStageLabel(event.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold" placeholder="مثال: اختر صفك" />
          </label>
          <label className="block font-bold">عرض صفحة المسار
            <select aria-label="عرض صفحة المسار" value={studentTemplate} onChange={event => setStudentTemplate(event.target.value as 'standard'|'simple')} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold">
              <option value="standard">العرض المعتاد</option>
              <option value="simple">عرض مبسط</option>
            </select>
          </label>
        </fieldset>

      <button type="button" disabled={pending === 'display-path'} onClick={() => void savePath({
        showInNavbar,
        showInHome,
        settings: { showSubjectCards, showMockExamCard, showPackageCard, studentTemplate, stageSelection, stageLabel: stageLabel.trim() || 'اختر مرحلتك' },
      })} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
        {pending === 'display-path' ? 'جارٍ الحفظ...' : 'حفظ عرض المسار'}
        </button>
      </fieldset>

      <div className="border-t border-indigo-100 pt-4">
        <p className="text-xs font-black text-indigo-700">مظهر المادة</p>
        {subject ? (
          <>
            <p className="mt-1 text-xs text-gray-500">المادة المحددة: {subject.name}</p>
            <fieldset disabled={pending === 'display-subject'} className="min-w-0">
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-black text-gray-700">
                أيقونة المادة
                <input aria-label="أيقونة المادة" value={icon} onChange={event => setIcon(event.target.value)} maxLength={24} className="rounded-xl border bg-white px-3 py-2.5 text-sm font-bold" placeholder="📚" />
              </label>
              <label className="grid gap-1 text-xs font-black text-gray-700">
                لون المادة
                <input aria-label="لون المادة" value={color} onChange={event => setColor(event.target.value)} maxLength={64} className="rounded-xl border bg-white px-3 py-2.5 text-sm font-bold" placeholder="#4f46e5 أو اسم اللون" />
              </label>
            </div>
            <button type="button" onClick={() => void saveSubject({ icon: icon.trim(), color: color.trim() })} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {pending === 'display-subject' ? 'جارٍ الحفظ...' : 'حفظ مظهر المادة'}
            </button>
            </fieldset>
          </>
        ) : <p className="mt-2 rounded-xl border border-dashed bg-white p-3 text-sm text-gray-500">أضف مادة لهذا المسار لتخصيص أيقونتها ولونها.</p>}
      </div>
    </section>
  );
}
