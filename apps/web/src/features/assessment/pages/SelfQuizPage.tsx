import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import { attemptClient } from '../api/attempt-client';
import { PreparedQuizList } from '../components/PreparedQuizList';
import { SelfQuizSkillPicker } from '../components/SelfQuizSkillPicker';

const emptyTaxonomy: TaxonomyFull = { paths: [], subjects: [], skills: [] };

export function SelfQuizPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, getCsrfToken } = useAuth();
  const requestedDifficulty = (params.get('difficulty') || '').toLowerCase();
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>(emptyTaxonomy);
  const [taxonomyError, setTaxonomyError] = useState('');
  const [mode, setMode] = useState(params.get('mode') === 'prepared' ? 'prepared' : params.get('mode') === 'self' || ['skillIds', 'pathId', 'subjectId', 'sectionId', 'questionCount', 'timeLimit', 'difficulty'].some(key => params.has(key)) ? 'self' : 'prepared');
  const [path, setPath] = useState(params.get('pathId') || '');
  const [subject, setSubject] = useState(params.get('subjectId') || '');
  const [section, setSection] = useState(params.get('sectionId') || '');
  const [skills, setSkills] = useState<string[]>(() => (params.get('skillIds') || '').split(',').map(x => x.trim()).filter(Boolean));
  const [count, setCount] = useState(Math.min(60, Math.max(5, Number(params.get('questionCount')) || 15)));
  const [minutes, setMinutes] = useState(Math.min(180, Math.max(5, Number(params.get('timeLimit')) || 20)));
  const [difficulty, setDifficulty] = useState(['easy', 'medium', 'hard'].includes(requestedDifficulty) ? requestedDifficulty : 'medium');
  const [questionType, setQuestionType] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState('');
  const startRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const autoStartRef = useRef(false);
  const evidence = ['remediation', 'recheck', 'mastery_review'].includes(params.get('evidenceType') || '') ? params.get('evidenceType')! : 'assessment';
  const scopedSkills = useMemo(() => taxonomy.skills.filter(s => (!section || s.sectionId === section) && (!subject || s.subjectId === subject) && (!path || taxonomy.subjects.some(x => x.id === s.subjectId && x.pathId === path))), [taxonomy, subject, path, section]);
  const subjects = useMemo(() => taxonomy.subjects.filter(s => !path || s.pathId === path), [taxonomy.subjects, path]);

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyFull(controller.signal).then(data => setTaxonomy({ ...data, paths: data.paths || [], subjects: data.subjects || [], skills: data.skills || [] })).catch(() => { if (!controller.signal.aborted) setTaxonomyError('تعذر تحميل المسارات والمهارات. حاول تحديث الصفحة.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setResumeId('');
    if (!user?.id) return;
    const storageKey = `self-quiz-resume:${user.id}`;
    let active = true;
    attemptClient.currentSelf().then(({ attempt }) => {
      if (!active) return;
      if (attempt.status === 'in_progress' && !attempt.assessmentId) setResumeId(attempt.id);
      else { try { localStorage.removeItem(storageKey); } catch { /* ignore unavailable storage */ } }
    }).catch(() => {
      let id = '';
      try { id = localStorage.getItem(storageKey) || ''; } catch { return; }
      if (!id) return;
      void attemptClient.get(id).then(({ attempt }) => {
        if (active && attempt.status === 'in_progress' && !attempt.assessmentId) setResumeId(attempt.id);
      }).catch(() => { /* keep the checkpoint for a later connection */ });
    });
    return () => { active = false; };
  }, [user?.id]);

  const start = async () => {
    if (!user || busy) return;
    if (evidence !== 'assessment' && skills.length === 0) { setError('اختر مهارة واحدة على الأقل للاختبار الموجّه.'); return; }
    const settings = { pathId: path, subjectId: subject, sectionId: section, skillIds: skills, difficulty, questionType, evidenceType: evidence, questionCount: count, timeLimitMinutes: minutes };
    const fingerprint = JSON.stringify([user.id, settings]);
    const storageKey = `self-quiz-start:${user.id}`;
    if (startRef.current?.fingerprint !== fingerprint) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as { fingerprint?: string; key?: string } | null;
        startRef.current = saved?.fingerprint === fingerprint && saved.key ? { fingerprint, key: saved.key } : { fingerprint, key: crypto.randomUUID() };
        sessionStorage.setItem(storageKey, JSON.stringify(startRef.current));
      } catch { startRef.current = { fingerprint, key: crypto.randomUUID() }; }
    }
    setBusy(true); setError('');
    try {
      const csrf = await getCsrfToken();
      const response = await attemptClient.startSelf({ ...settings, startKey: startRef.current.key }, csrf);
      try { sessionStorage.removeItem(storageKey); } catch { /* storage may be disabled */ }
      try { localStorage.setItem(`self-quiz-resume:${user.id}`, response.attempt.id); } catch { /* attempt URL remains usable */ }
      navigate(`/assessment-attempts/${encodeURIComponent(response.attempt.id)}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message === 'No eligible questions' ? 'لا توجد أسئلة متاحة لهذا الاختيار حاليًا.' : 'تعذر بدء الاختبار. تحقق من الاختيارات وحاول مرة أخرى.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (params.get('autostart') === '1' && params.get('mode') === 'self' && !loading && user && !autoStartRef.current) {
      autoStartRef.current = true;
      void start();
    }
  });

  return <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
    <div className="max-w-3xl w-full rounded-2xl bg-white border border-gray-100 shadow-sm p-5 sm:p-7 space-y-5">
      <h1 className="text-center text-2xl sm:text-3xl font-bold text-gray-800">اختبار ساهر</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-100 rounded-xl p-1">
        <button type="button" onClick={() => setMode('prepared')} className={`py-3 rounded-lg font-bold ${mode === 'prepared' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}>اختبار جاهز</button>
        <button type="button" onClick={() => setMode('self')} className={`py-3 rounded-lg font-bold ${mode === 'self' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}>اختبار ذاتي</button>
      </div>
      {(error || (mode === 'self' && taxonomyError)) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || taxonomyError}</div>}
      {resumeId && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h2 className="font-bold text-amber-900">يوجد تقدم محفوظ</h2><p className="text-sm text-amber-700 mt-1">استكمل الاختبار المحفوظ والوقت المتبقي.</p></div><Link to={`/assessment-attempts/${encodeURIComponent(resumeId)}`} className="rounded-lg bg-amber-600 px-4 py-2 text-center font-bold text-white">استعادة التقدم</Link></div>}
      {mode === 'prepared' ? <PreparedQuizList /> : <div className="space-y-4">
        <p className="text-sm font-bold text-gray-600">اختبار ذاتي بمواصفاتك</p>
        {section && <div className="flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800"><span>القسم: {taxonomy.sections?.find(item => item.id === section)?.name || 'القسم المحدد'}</span><button type="button" onClick={() => { setSection(''); setSkills([]); }} className="text-xs underline">إزالة تحديد القسم</button></div>}
        {evidence !== 'assessment' && <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">اختبار موجّه للمهارات المحددة؛ تُختار الأسئلة من نفس نطاقها.</div>}
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-gray-700">المسار<select value={path} onChange={e => { setPath(e.target.value); setSubject(''); setSection(''); setSkills([]); }} className="mt-2 min-h-[42px] w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">كل المسارات</option>{taxonomy.paths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-xs font-bold text-gray-700">المادة<select value={subject} onChange={e => { setSubject(e.target.value); setSection(''); setSkills([]); }} className="mt-2 min-h-[42px] w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="">كل المواد</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="text-xs font-bold text-gray-700">عدد الأسئلة<input type="number" min={5} max={60} value={count} onChange={e => setCount(Math.max(5, Math.min(60, Number(e.target.value) || 5)))} className="mt-2 min-h-[42px] w-full px-4 py-2 border border-gray-300 rounded-lg" /></label>
          <label className="text-xs font-bold text-gray-700">الوقت (بالدقائق)<input type="number" min={5} max={180} value={minutes} onChange={e => setMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 5)))} className="mt-2 min-h-[42px] w-full px-4 py-2 border border-gray-300 rounded-lg" /></label>
          <label className="text-xs font-bold text-gray-700">نوع الأسئلة<select value={questionType} onChange={e => setQuestionType(e.target.value)} className="mt-2 min-h-[42px] w-full px-4 py-2 border border-gray-300 rounded-lg"><option value="all">الكل</option><option value="mcq">اختيار من متعدد</option><option value="true_false">صح / خطأ</option></select></label>
        </div>
        <SelfQuizSkillPicker skills={scopedSkills} sections={taxonomy.sections || []} selected={skills} onChange={setSkills} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{([['easy','سهل'],['medium','متوسط'],['hard','صعب']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setDifficulty(value)} className={`p-4 rounded-xl border-2 font-bold ${difficulty === value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'}`}>{label}</button>)}</div>
        {!loading && !user ? <Link to="/login" className="block rounded-xl bg-indigo-600 px-4 py-4 text-center text-lg font-bold text-white">سجل الدخول لبدء الاختبار</Link> : <button type="button" disabled={loading || busy} onClick={() => void start()} className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-lg font-bold text-white disabled:opacity-50">{busy ? 'جارٍ إعداد الاختبار...' : 'ابدأ الاختبار الذاتي الآن'}</button>}
      </div>}
    </div>
  </main>;
}

