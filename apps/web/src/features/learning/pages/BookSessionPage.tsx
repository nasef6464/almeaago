import { ArrowRight, Calendar, CheckCircle2, Clock, Sparkles, UserCheck } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import { sessionBookingsClient } from '../api/learning-client';

function todayInRiyadh(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export default function BookSessionPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialSkillId = searchParams.get('skillId') || '';
  const initialSkillName = searchParams.get('skillName') || '';
  const initialSubjectName = searchParams.get('subjectName') || '';
  const initialSectionName = searchParams.get('sectionName') || '';
  const initialPathId = searchParams.get('pathId') || '';
  const initialSubjectId = searchParams.get('subjectId') || '';
  const source = searchParams.get('source') || '';

  const [taxonomy, setTaxonomy] = useState<TaxonomyFull | null>(null);
  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [sectionId, setSectionId] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(() =>
    initialSkillId ? [initialSkillId] : [],
  );

  const [title, setTitle] = useState(() =>
    initialSkillName ? `حصة تقوية: ${initialSkillName}` : 'حصة فردية مخصصة',
  );
  const [scheduledDate, setScheduledDate] = useState(() => todayInRiyadh());
  const [scheduledTime, setScheduledTime] = useState('16:00');
  const [notes, setNotes] = useState(() =>
    initialSkillName
      ? `التركيز على مهارة "${initialSkillName}"${initialSubjectName ? ` (${initialSubjectName})` : ''}.`
      : '',
  );
  const [requestKey, setRequestKey] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `bk-${crypto.randomUUID()}`
      : `bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyFull(controller.signal)
      .then((data) => {
        setTaxonomy(data);
        if (!pathId && data.paths.length > 0) {
          const matchedPath = initialPathId
            ? data.paths.find((p) => p.id === initialPathId)
            : data.paths[0];
          if (matchedPath) setPathId(matchedPath.id);
        }
      })
      .catch(() => {
        // Keep query-param target fallback functional if taxonomy bootstrap fails.
      });
    return () => controller.abort();
  }, [initialPathId, pathId]);

  const availableSubjects = useMemo(() => {
    if (!taxonomy) return [];
    return taxonomy.subjects.filter((s) => !pathId || s.pathId === pathId);
  }, [taxonomy, pathId]);

  const availableSections = useMemo(() => {
    if (!taxonomy?.sections) return [];
    return taxonomy.sections.filter((sec) => !subjectId || sec.subjectId === subjectId);
  }, [taxonomy, subjectId]);

  const availableSkills = useMemo(() => {
    if (!taxonomy) return [];
    const allowedSubjectIds = new Set(availableSubjects.map((s) => s.id));
    return taxonomy.skills.filter((sk) => {
      if (sectionId && sk.sectionId !== sectionId) return false;
      if (subjectId && sk.subjectId !== subjectId) return false;
      if (pathId && !allowedSubjectIds.has(sk.subjectId)) return false;
      return true;
    });
  }, [taxonomy, availableSubjects, pathId, subjectId, sectionId]);

  const resolvedTargetLabel = useMemo(() => {
    const pathName = taxonomy?.paths.find((p) => p.id === pathId)?.name || '';
    const subjName =
      taxonomy?.subjects.find((s) => s.id === subjectId)?.name || initialSubjectName;
    const secName =
      taxonomy?.sections?.find((sec) => sec.id === sectionId)?.name || initialSectionName;
    const skillNames = selectedSkillIds
      .map((id) => taxonomy?.skills.find((sk) => sk.id === id)?.name || '')
      .filter(Boolean);
    const parts = [
      pathName,
      subjName,
      secName,
      skillNames.length > 0 ? skillNames.join('، ') : initialSkillName,
    ].filter(Boolean);
    return parts.join(' > ') || title.trim() || 'حصة فردية';
  }, [
    taxonomy,
    pathId,
    subjectId,
    sectionId,
    selectedSkillIds,
    initialSubjectName,
    initialSectionName,
    initialSkillName,
    title,
  ]);

  if (!authLoading && !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate replace to={`/login?next=${next}`} />;
  }

  function toggleSkill(skillId: string) {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('يرجى إدخال عنوان أو هدف الحصة.');
      return;
    }
    if (!scheduledDate || scheduledDate < todayInRiyadh()) {
      setError('يجب اختيار تاريخ اليوم أو تاريخ قادم بتوقيت الرياض.');
      return;
    }
    if (!scheduledTime.trim()) {
      setError('يرجى اختيار الوقت المفضل للحصة.');
      return;
    }

    setSubmitting(true);
    try {
      const csrf = await getCsrfToken();
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const res = await sessionBookingsClient.create(
        {
          title: title.trim(),
          targetLabel: resolvedTargetLabel,
          scheduledDate,
          scheduledTime,
          notes: notes.trim(),
          requestKey,
          pathId: uuidPattern.test(pathId) ? pathId : undefined,
          subjectId: uuidPattern.test(subjectId) ? subjectId : undefined,
          sectionId: uuidPattern.test(sectionId) ? sectionId : undefined,
          skillIds: selectedSkillIds.filter((id) => uuidPattern.test(id)),
        },
        csrf,
      );
      setSubmittedId(res.booking.id);
      setRequestKey(
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `bk-${crypto.randomUUID()}`
          : `bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال طلب الحجز.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard?tab=sessions"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة للحصص واللقاءات</span>
          </Link>
          <Link
            to="/my-requests"
            className="text-xs font-black text-indigo-700 hover:underline"
          >
            استعراض طلباتي السابقة
          </Link>
        </div>

        <section className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-7 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              <Sparkles size={14} />
              <span>حجز حصة فردية مع مدرب</span>
            </span>
            {source === 'reports' && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                من تقرير المهارات
              </span>
            )}
            {source === 'quiz-result' && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                من نتيجة الاختبار
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            احجز جلسة شرح خاصة وموجهة لمهارتك
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-600">
            حدد المسار والمهارة والوقت المناسب بتوقيت الرياض، وسيرتبط الطلب مباشرة بقسم الحصص وطلباتك.
          </p>

          {submittedId ? (
            <div
              role="status"
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
            >
              <div className="flex items-center gap-2 text-base font-black">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span>تم استلام طلب الحجز بنجاح</span>
              </div>
              <p className="mt-2 text-sm font-bold text-emerald-800">
                تم تسجيل الحجز بحالة &ldquo;قيد الانتظار&rdquo; ليراجعه المشرف ويحدد المعلم المناسب.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard?tab=sessions')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  متابعة حجوزاتي في لوحة الطالب
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittedId('')}
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                >
                  حجز موعد آخر
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="booking-title" className="block text-sm font-black text-slate-800 mb-1.5">
                  عنوان الجلسة المطلوبة
                </label>
                <input
                  id="booking-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: شرح مهارة النسبة المئوية وحل مسائلها"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="booking-path" className="block text-xs font-black text-slate-700 mb-1">
                    المسار
                  </label>
                  <select
                    id="booking-path"
                    value={pathId}
                    onChange={(e) => {
                      setPathId(e.target.value);
                      setSubjectId('');
                      setSectionId('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <option value="">كل المسارات</option>
                    {taxonomy?.paths.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-subject" className="block text-xs font-black text-slate-700 mb-1">
                    المادة
                  </label>
                  <select
                    id="booking-subject"
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setSectionId('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <option value="">اختر المادة</option>
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="booking-section" className="block text-xs font-black text-slate-700 mb-1">
                    القسم
                  </label>
                  <select
                    id="booking-section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
                  >
                    <option value="">كل الأقسام</option>
                    {availableSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {availableSkills.length > 0 && (
                <div>
                  <span className="block text-xs font-black text-slate-700 mb-2">
                    المهارات المستهدفة (اختياري)
                  </span>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    {availableSkills.slice(0, 40).map((sk) => {
                      const active = selectedSkillIds.includes(sk.id);
                      return (
                        <button
                          key={sk.id}
                          type="button"
                          onClick={() => toggleSkill(sk.id)}
                          aria-pressed={active}
                          className={`rounded-full px-3 py-1 text-xs font-black transition ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {sk.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
                <span className="text-slate-500">نطاق الجلسة المحدد: </span>
                <span>{resolvedTargetLabel}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="booking-date" className="flex items-center gap-1.5 text-sm font-black text-slate-800 mb-1.5">
                    <Calendar size={15} className="text-indigo-600" />
                    <span>تاريخ الحصة (بتوقيت الرياض)</span>
                  </label>
                  <input
                    id="booking-date"
                    type="date"
                    required
                    min={todayInRiyadh()}
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="booking-time" className="flex items-center gap-1.5 text-sm font-black text-slate-800 mb-1.5">
                    <Clock size={15} className="text-indigo-600" />
                    <span>الوقت المفضل</span>
                  </label>
                  <input
                    id="booking-time"
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="booking-notes" className="block text-sm font-black text-slate-800 mb-1.5">
                  ملاحظات إضافية للمدرب
                </label>
                <textarea
                  id="booking-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اذكر النقاط التي ترغب بالتركيز عليها أو أي أسئلة محددة..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <UserCheck size={15} className="text-emerald-600" />
                  <span>سيظهر الحجز في تبويب اللقاءات وصفحة طلباتي فور الإرسال</span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? 'جاري إرسال الطلب...' : 'تأكيد طلب حجز الحصة'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
