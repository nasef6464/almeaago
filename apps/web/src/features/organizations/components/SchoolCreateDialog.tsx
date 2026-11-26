import { useState, type FormEvent } from 'react';
import { Building2, X } from 'lucide-react';
import { OrganizationsApiError, organizationsClient, type SchoolSummary } from '../api/organizations-client';

interface Props {
  open: boolean;
  getCsrfToken: () => Promise<string>;
  onClose: () => void;
  onCreated: (school: SchoolSummary) => void;
}

const initialForm = {
  name: '',
  code: '',
  directorName: '',
  directorEmail: '',
  initialClass: 'الصف الأول الثانوي',
};

const createErrors: Partial<Record<number, string>> = {
  400: 'راجع اسم المدرسة والرمز التعريفي ثم حاول مرة أخرى.',
  401: 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.',
  403: 'إنشاء المدارس متاح لمدير المنصة.',
  409: 'الرمز التعريفي مستخدم لمدرسة أخرى. اختر رمزًا مختلفًا.',
};

export function SchoolCreateDialog({ open, getCsrfToken, onClose, onCreated }: Props) {
  const [wizardForm, setWizardForm] = useState(initialForm);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState('');

  function close() {
    setWizardError('');
    onClose();
  }

  async function handleCreateSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = wizardForm.name.trim();
    const code = wizardForm.code.trim().toUpperCase();
    if (!name || !code) {
      setWizardError('يرجى كتابة اسم المدرسة والرمز التعريفي.');
      return;
    }

    setWizardBusy(true);
    setWizardError('');
    try {
      const { school } = await organizationsClient.createSchool({
        name,
        code,
        metadata: {
          directorName: wizardForm.directorName,
          directorEmail: wizardForm.directorEmail,
          initialClass: wizardForm.initialClass,
        },
      }, await getCsrfToken());
      if (!school?.id) throw new Error('School creation returned no school');
      setWizardForm(initialForm);
      close();
      onCreated(school);
    } catch (error) {
      const status = error instanceof OrganizationsApiError ? error.status : 0;
      setWizardError(createErrors[status] ?? 'تعذر إنشاء المدرسة الآن. حاول مرة أخرى.');
    } finally {
      setWizardBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-school-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-indigo-600" />
            <h3 id="create-school-title" className="text-lg font-black text-gray-900">إضافة مدرسة جديدة للشراكات</h3>
          </div>
          <button
            type="button"
            aria-label="إغلاق نافذة إضافة المدرسة"
            disabled={wizardBusy}
            onClick={close}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateSchool} className="mt-4 space-y-4">
          {wizardError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              {wizardError}
            </p>
          )}
          <div>
            <label className="block text-xs font-black text-gray-700">اسم المدرسة</label>
            <input
              type="text"
              required
              value={wizardForm.name}
              onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })}
              placeholder="مثال: مدرسة دار العلوم الأهلية"
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700">الرمز التعريفي للمدرسة (Code)</label>
            <input
              type="text"
              required
              value={wizardForm.code}
              onChange={(e) => setWizardForm({ ...wizardForm, code: e.target.value })}
              placeholder="مثال: SCH-DAR-01"
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:outline-none uppercase"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black text-gray-700">اسم مدير المدرسة</label>
              <input
                type="text"
                value={wizardForm.directorName}
                onChange={(e) => setWizardForm({ ...wizardForm, directorName: e.target.value })}
                placeholder="مثال: أ. محمد العتيبي"
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-700">البريد الإلكتروني للإدارة</label>
              <input
                type="email"
                value={wizardForm.directorEmail}
                onChange={(e) => setWizardForm({ ...wizardForm, directorEmail: e.target.value })}
                placeholder="director@school.edu.sa"
                className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700">الفصل الافتراضي الأولي</label>
            <input
              type="text"
              value={wizardForm.initialClass}
              onChange={(e) => setWizardForm({ ...wizardForm, initialClass: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={wizardBusy}
              onClick={close}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={wizardBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              data-testid="submit-create-school-btn"
            >
              {wizardBusy ? 'جاري الإنشاء...' : 'إنشاء المدرسة وتجهيز مساحة العمل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
