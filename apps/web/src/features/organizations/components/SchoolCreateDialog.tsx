import { useEffect, useState, type FormEvent } from 'react';
import { Building2, X } from 'lucide-react';
import { authClient } from '../../auth/api/auth-client';
import type { SchoolSummary } from '../api/organizations-client';
import { ALL_CONTRACT_MODULES, PACKAGE_TIERS } from '../utils/schoolContractModules';
import { provisionSchool, SchoolSetupError, schoolSetupStages, type SchoolSetup, type SchoolSetupStage } from '../utils/provisionSchool';

interface Props {
  actorId: string;
  open: boolean;
  getCsrfToken: () => Promise<string>;
  onClose: () => void;
  onCreated: (school: SchoolSummary) => void;
}

const steps = ['بيانات المدرسة', 'العقد والخدمات', 'مدير المدرسة', 'الفصول المبدئية'];
const suggestedClasses = ['أول ثانوي - أ', 'أول ثانوي - ب', 'ثاني ثانوي - علمي أ', 'ثاني ثانوي - علمي ب', 'ثالث ثانوي - عام أ'];
const inputClass = 'mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-500 focus:outline-none';

function readSetup(key: string): SchoolSetup | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null') as SchoolSetup | null;
    if (!draft || !draft.requestId || !draft.name || !draft.code || !draft.validFrom || !draft.validUntil ||
      !Array.isArray(draft.modules) || !draft.modules.every(value => typeof value === 'string') ||
      !Array.isArray(draft.classNames) || !draft.classNames.every(value => typeof value === 'string')) return null;
    return draft;
  } catch {
    return null;
  }
}

export function SchoolCreateDialog({ actorId, open, getCsrfToken, onClose, onCreated }: Props) {
  const storageKey = `almeaa.school-setup.${actorId}`;
  const [setup, setSetup] = useState(() => readSetup(storageKey));
  const [step, setStep] = useState(() => setup ? 4 : 1);
  const [name, setName] = useState(setup?.name ?? '');
  const [code, setCode] = useState(setup?.code ?? '');
  const [city, setCity] = useState(setup?.city ?? '');
  const [stage, setStage] = useState(setup?.stage ?? '');
  const [modules, setModules] = useState(setup?.modules ?? ['SCHOOL_CORE']);
  const [classText, setClassText] = useState(setup?.classNames.join('\n') ?? '');
  const [directorId, setDirectorId] = useState(setup?.directorId ?? '');
  const [directorSearch, setDirectorSearch] = useState('');
  const [directorQuery, setDirectorQuery] = useState({ search: '' });
  const [directorChoices, setDirectorChoices] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [directorError, setDirectorError] = useState('');
  const [directorLoading, setDirectorLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<SchoolSetupStage | null>(null);

  useEffect(() => {
    if (!open || step !== 3) return;
    const controller = new AbortController();
    setDirectorLoading(true);
    setDirectorError('');
    void authClient.adminListUsers({ role: 'school_admin', isActive: true, limit: 100, search: directorQuery.search }, controller.signal)
      .then(({ users }) => {
        if (!controller.signal.aborted) setDirectorChoices(users);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDirectorError('تعذر تحميل حسابات المديرين. أعد البحث.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDirectorLoading(false);
      });
    return () => controller.abort();
  }, [directorQuery, open, step]);

  function saveDraft(value: SchoolSetup | null) {
    setSetup(value);
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  }

  function close() {
    setError('');
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (step < 4) {
      if (step === 1 && (!name.trim() || !code.trim())) {
        setError('يرجى كتابة اسم المدرسة والرمز التعريفي.');
        return;
      }
      setStep(step + 1);
      return;
    }

    const classNames = classText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const bytes = new TextEncoder();
    if (!setup && (bytes.encode(code.trim().toUpperCase()).length > 64 || bytes.encode(name.trim()).length > 160)) {
      setError('اسم المدرسة أو الرمز التعريفي أطول من الحد المقبول.');
      setStep(1);
      return;
    }
    if (!setup && (new Set(classNames).size !== classNames.length || classNames.some(value => bytes.encode(value).length > 160))) {
      setError('اكتب اسمًا مختلفًا لكل فصل، واستعمل أسماء مختصرة.');
      return;
    }
    const now = Date.now();
    const draft = setup ?? {
      requestId: crypto.randomUUID(), name: name.trim(), code: code.trim().toUpperCase(),
      city: city.trim(), stage: stage.trim(), modules, classNames, directorId,
      validFrom: new Date(now).toISOString(), validUntil: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    setBusy(true);
    try {
      saveDraft(draft);
      const school = await provisionSchool(draft, await getCsrfToken(),
        schoolId => saveDraft({ ...draft, schoolId }), setProgress);
      saveDraft(null);
      setStep(1);
      setName(''); setCode(''); setCity(''); setStage('');
      setModules(['SCHOOL_CORE']); setClassText(''); setDirectorId(''); setDirectorSearch(''); setDirectorQuery({ search: '' });
      close();
      onCreated(school);
    } catch (cause) {
      if (cause instanceof SchoolSetupError && cause.editable) {
        saveDraft(null);
        setStep(1);
      }
      setError(cause instanceof SchoolSetupError ? cause.message : 'تعذر بدء التأسيس. أعد المحاولة.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-school-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="shrink-0 text-indigo-600" />
            <h3 id="create-school-title" className="text-lg font-black text-gray-900">إضافة مدرسة جديدة للشراكات</h3>
          </div>
          <button type="button" aria-label="إغلاق نافذة إضافة المدرسة" disabled={busy} onClick={close} className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <ol aria-label="خطوات تأسيس المدرسة" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined}
              className={`rounded-xl px-2 py-2 text-center text-xs font-bold ${step === index + 1 ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-600'}`}>
              {label}
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="mt-4 space-y-4">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p>}
          {progress && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">جارٍ التحقق من {schoolSetupStages[progress]}…</p>}
          {setup ? (
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <h4 className="font-bold">استكمال تأسيس {setup.name}</h4>
              <p>تستأنف المحاولة من السجل نفسه وتتحقق من الخطوات المحفوظة.</p>
            </div>
          ) : step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">اسم المدرسة
                <input required value={name} onChange={event => setName(event.target.value)} placeholder="مثال: مدرسة دار العلوم الأهلية" className={inputClass} />
              </label>
              <label className="text-sm font-bold">الرمز التعريفي
                <input required value={code} onChange={event => setCode(event.target.value)} placeholder="مثال: SCH-DAR-01" dir="ltr" className={inputClass} />
              </label>
              <label className="text-sm font-bold">المرحلة الدراسية
                <input value={stage} onChange={event => setStage(event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-bold">المدينة
                <input value={city} onChange={event => setCity(event.target.value)} className={inputClass} />
              </label>
            </div>
          ) : step === 2 ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold">الخدمات المتاحة للمدرسة</legend>
              <p className="text-xs text-slate-600">مدة العقد سنة من تاريخ بدء التأسيس.</p>
              <label className="block text-sm font-bold">نموذج الخدمات
                <select value={PACKAGE_TIERS.find(tier => tier.modules.length === modules.length && tier.modules.every(id => modules.includes(id)))?.id ?? ''}
                  onChange={event => {
                    const selected = PACKAGE_TIERS.find(tier => tier.id === event.target.value);
                    if (selected) setModules([...selected.modules]);
                  }} className={inputClass}>
                  <option value="" disabled>اختيار مخصص</option>
                  {PACKAGE_TIERS.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_CONTRACT_MODULES.map(module => (
                  <label key={module.id} className="flex items-start gap-2 rounded-xl border p-3 text-xs font-bold">
                    <input type="checkbox" checked={modules.includes(module.id)} disabled={module.id === 'SCHOOL_CORE'}
                      onChange={event => setModules(items => event.target.checked ? [...items, module.id] : items.filter(id => id !== module.id))} />
                    {module.title}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : step === 3 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">اختر حساب مدير موجودًا لربطه بالمدرسة، أو اترك الربط لوقت لاحق.</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 text-sm font-bold">بحث عن حساب مدير
                  <input value={directorSearch} onChange={event => setDirectorSearch(event.target.value)} className={inputClass} />
                </label>
                <button type="button" onClick={() => { setDirectorId(''); setDirectorQuery({ search: directorSearch.trim() }); }}
                  className="rounded-xl border px-3 py-2 text-sm font-bold">بحث</button>
              </div>
              <label className="block text-sm font-bold">مدير المدرسة
                <select aria-label="مدير المدرسة" value={directorId} disabled={directorLoading} onChange={event => setDirectorId(event.target.value)} className={inputClass}>
                  <option value="">ربط المدير لاحقًا</option>
                  {directorChoices.map(director => <option key={director.id} value={director.id}>{director.name} · {director.email}</option>)}
                </select>
              </label>
              {directorLoading && <p role="status" className="text-sm text-slate-600">جارٍ تحميل حسابات المديرين…</p>}
              {directorError && <p role="alert" className="text-sm text-rose-800">{directorError}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-bold">الفصول المبدئية
                <textarea rows={5} value={classText} onChange={event => setClassText(event.target.value)} className={inputClass} aria-label="الفصول المبدئية" />
                <span className="text-xs font-normal text-slate-600">اكتب اسم كل فصل في سطر، أو أضف الفصول لاحقًا من مساحة المدرسة.</span>
              </label>
              {stage.includes('ثانوي') && (
                <button type="button" className="rounded-xl border px-3 py-2 text-sm font-bold"
                  onClick={() => setClassText(value => Array.from(new Set([...value.split(/\r?\n/).map(line => line.trim()).filter(Boolean), ...suggestedClasses])).join('\n'))}>
                  إضافة الفصول المقترحة للثانوي
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
            <button type="button" disabled={busy} onClick={close} className="rounded-xl border px-3 py-2 text-sm font-bold">
              {setup ? 'متابعة لاحقًا' : 'إلغاء'}
            </button>
            {step > 1 && !setup && (
              <button type="button" onClick={() => { setStep(step - 1); setError(''); }} className="rounded-xl border px-3 py-2 text-sm font-bold">السابق</button>
            )}
            <button type="submit" disabled={busy} data-testid={step === 4 ? 'submit-create-school-btn' : undefined}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {step < 4 ? 'التالي' : busy ? 'جارٍ التأسيس…' : setup ? 'استكمال التأسيس' : 'إنشاء المدرسة وتجهيز مساحة العمل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
