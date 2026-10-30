import { useEffect, useState } from 'react';

import type {
  AdminTaxonomyPath,
  AdminTaxonomySubject,
  PathDisplayInput,
  SubjectDisplayInput,
} from '../api/taxonomy-admin-client';

type Props = {
  path: AdminTaxonomyPath;
  subject: AdminTaxonomySubject | null;
  pending: string;
  savePath: (input: PathDisplayInput) => Promise<boolean>;
  saveSubject: (input: SubjectDisplayInput) => Promise<boolean>;
};

export function TaxonomyDisplayEditor({ path, subject, pending, savePath, saveSubject }: Props) {
  const [showInNavbar, setShowInNavbar] = useState(path.showInNavbar !== false);
  const [showInHome, setShowInHome] = useState(path.showInHome !== false);
  const [showMockExamCard, setShowMockExamCard] = useState(path.settings?.showMockExamCard !== false);
  const [stageSelection, setStageSelection] = useState(path.settings?.stageSelection ?? 'auto');
  const [stageLabel, setStageLabel] = useState(path.settings?.stageLabel ?? '');
  const [icon, setIcon] = useState(subject?.icon ?? '');
  const [color, setColor] = useState(subject?.color ?? '');

  useEffect(() => {
    setShowInNavbar(path.showInNavbar !== false);
    setShowInHome(path.showInHome !== false);
    setShowMockExamCard(path.settings?.showMockExamCard !== false);
    setStageSelection(path.settings?.stageSelection ?? 'auto');
    setStageLabel(path.settings?.stageLabel ?? '');
  }, [path.id, path.showInNavbar, path.showInHome, path.settings?.showMockExamCard, path.settings?.stageSelection, path.settings?.stageLabel]);

  useEffect(() => {
    setIcon(subject?.icon ?? '');
    setColor(subject?.color ?? '');
  }, [subject?.id, subject?.icon, subject?.color]);

  return (
    <section data-testid="taxonomy-display-editor" className="mt-4 space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div>
        <p className="text-xs font-black text-indigo-700">عرض المسار</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold">
            <input aria-label="إظهار المسار في القائمة العلوية" type="checkbox" checked={showInNavbar} onChange={event => setShowInNavbar(event.target.checked)} />
            إظهار المسار في القائمة العلوية
          </label>
          <label className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold">
            <input aria-label="إظهار المسار في الصفحة الرئيسية" type="checkbox" checked={showInHome} onChange={event => setShowInHome(event.target.checked)} />
            إظهار المسار في الصفحة الرئيسية
          </label>
          <label className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold sm:col-span-2">
            <input aria-label="إظهار بطاقة الاختبارات المحاكية" type="checkbox" checked={showMockExamCard} onChange={event => setShowMockExamCard(event.target.checked)} />
            إظهار بطاقة الاختبارات المحاكية
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-black text-gray-700">
          طريقة اختيار المرحلة
          <select aria-label="طريقة اختيار المرحلة" value={stageSelection} onChange={event => setStageSelection(event.target.value as 'auto'|'required'|'none')} className="rounded-xl border bg-white px-3 py-2.5 text-sm font-bold">
            <option value="auto">تلقائي حسب المرحلة المتاحة</option>
            <option value="required">إلزامي</option>
            <option value="none">بدون مرحلة</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-gray-700">
          تسمية المرحلة
          <input aria-label="تسمية المرحلة" value={stageLabel} onChange={event => setStageLabel(event.target.value)} maxLength={120} className="rounded-xl border bg-white px-3 py-2.5 text-sm font-bold" placeholder="اتركه فارغًا لاستخدام التسمية الافتراضية" />
        </label>
      </div>

      <button type="button" disabled={pending === 'display-path'} onClick={() => void savePath({
        showInNavbar,
        showInHome,
        settings: { showMockExamCard, stageSelection, stageLabel: stageLabel.trim() },
      })} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
        {pending === 'display-path' ? 'جارٍ الحفظ...' : 'حفظ عرض المسار'}
      </button>

      <div className="border-t border-indigo-100 pt-4">
        <p className="text-xs font-black text-indigo-700">مظهر المادة</p>
        {subject ? (
          <>
            <p className="mt-1 text-xs text-gray-500">المادة المحددة: {subject.name}</p>
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
            <button type="button" disabled={pending === 'display-subject'} onClick={() => void saveSubject({ icon: icon.trim(), color: color.trim() })} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {pending === 'display-subject' ? 'جارٍ الحفظ...' : 'حفظ مظهر المادة'}
            </button>
          </>
        ) : <p className="mt-2 rounded-xl border border-dashed bg-white p-3 text-sm text-gray-500">أضف مادة لهذا المسار لتخصيص أيقونتها ولونها.</p>}
      </div>
    </section>
  );
}
