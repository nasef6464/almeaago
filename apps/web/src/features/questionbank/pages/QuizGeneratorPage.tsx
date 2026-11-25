import { ArrowRight, CheckCircle2, FileUp, Loader2, Save, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { aiClient, type GeneratedQuestion } from '../../ai/api/ai-client';
import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import { questionBankClient } from '../api/questionbank-client';

function normalizeDifficulty(raw: string): string {
  const lower = (raw || '').trim().toLowerCase();
  if (lower === 'easy' || lower === 'سهل') return 'easy';
  if (lower === 'hard' || lower === 'صعب') return 'hard';
  return 'medium';
}

export default function QuizGeneratorPage() {
  const { user, getCsrfToken } = useAuth();
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull | null>(null);
  const [pathId, setPathId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [promptText, setPromptText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [generating, setGenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [meta, setMeta] = useState<{ provider: string; model: string; latencyMs: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyFull(controller.signal)
      .then((data) => {
        setTaxonomy(data);
        if (data.paths[0]) {
          setPathId((prev) => prev || data.paths[0].id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const subjects = useMemo(
    () => (taxonomy ? taxonomy.subjects.filter((s) => !pathId || s.pathId === pathId) : []),
    [taxonomy, pathId],
  );
  const skills = useMemo(() => {
    if (!taxonomy) return [];
    const allowedSubjectIds = new Set(subjects.map((s) => s.id));
    return taxonomy.skills.filter(
      (sk) => (!pathId || allowedSubjectIds.has(sk.subjectId)) && (!subjectId || sk.subjectId === subjectId),
    );
  }, [taxonomy, subjects, pathId, subjectId]);

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    if (!promptText.trim() && !file) {
      setError('يرجى كتابة موضوع الأسئلة أو إرفاق ملف مرجعي.');
      return;
    }

    const selectedPath = taxonomy?.paths.find((p) => p.id === pathId)?.name;
    const selectedSubject = taxonomy?.subjects.find((s) => s.id === subjectId)?.name;
    const selectedSkill = taxonomy?.skills.find((sk) => sk.id === skillId)?.name;
    const contextHeader = [
      selectedPath ? `المسار: ${selectedPath}` : '',
      selectedSubject ? `المادة: ${selectedSubject}` : '',
      selectedSkill ? `المهارة: ${selectedSkill}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    const fullPrompt = contextHeader ? `${contextHeader}\n${promptText.trim()}` : promptText.trim();

    setGenerating(true);
    try {
      const csrf = await getCsrfToken();
      const res = await aiClient.generateAssessment({ promptText: fullPrompt, file: file || undefined }, csrf);
      setQuestions(res.questions || []);
      setSavedIndexes([]);
      setMeta({ provider: res.provider, model: res.model, latencyMs: res.latencyMs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر توليد الأسئلة عبر الذكاء الاصطناعي.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveToBank(q: GeneratedQuestion, idx: number) {
    if (!pathId || !subjectId) {
      setError('اختر المسار والمادة لحفظ السؤال في بنك الأسئلة.');
      return;
    }
    setError('');
    setSavingIndex(idx);
    try {
      const csrf = await getCsrfToken();
      const isTeacher = user?.roles.includes('teacher') && !user?.roles.includes('admin');
      const code = `AIQ-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
      await questionBankClient.create(
        {
          questionCode: code,
          ownerType: isTeacher ? 'teacher' : 'platform',
          ownerId: isTeacher ? user?.id || '' : '',
          assignedTeacherId: isTeacher ? user?.id || '' : '',
          version: {
            pathId,
            subjectId,
            type: 'mcq',
            text: q.text,
            imageAssetId: '',
            imageAlt: '',
            optionsEmbeddedInImage: false,
            correctOptionIndex: q.correctAnswer >= 0 ? q.correctAnswer : 0,
            explanation: q.explanation || '',
            hint: '',
            solvingStrategy: '',
            videoUrl: '',
            sourceMeta: { generatedBy: meta?.provider || 'ai', model: meta?.model || '' },
            aiContext: { skills: q.skills || [] },
            voiceExplanation: {},
            difficulty: normalizeDifficulty(q.difficulty),
            examType: 'practice',
            source: 'ai-quiz-gen',
            year: null,
            revisionNote: 'Generated by QuizGeneratorPage',
            options: q.options.map((text) => ({ text, assetId: '' })),
            skillLinks: skillId ? [{ skillId, relationType: 'main' }] : [],
          },
        },
        csrf,
      );
      setSavedIndexes((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
      setStatusMessage(`تم حفظ السؤال ${idx + 1} كمسودة في بنك الأسئلة.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ السؤال في بنك الأسئلة.');
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/question-bank"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة لبنك الأسئلة</span>
          </Link>
        </div>

        <header className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-2xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
            <Sparkles size={14} />
            <span>توليد الأسئلة بالذكاء الاصطناعي</span>
          </span>
          <h1 className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            مولد الاختبارات والأسئلة الذكي
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            ولّد أسئلة اختيار من متعدد مربوطة بالمسار والمهارة، وراجعها ثم احفظها مباشرة في بنك الأسئلة.
          </p>

          <form onSubmit={handleGenerate} className="mt-5 space-y-4">
            {error && (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}
            {statusMessage && (
              <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {statusMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="qgen-path" className="block text-xs font-black text-slate-700 mb-1">
                  المسار
                </label>
                <select
                  id="qgen-path"
                  value={pathId}
                  onChange={(e) => {
                    setPathId(e.target.value);
                    setSubjectId('');
                    setSkillId('');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                >
                  <option value="">اختر المسار</option>
                  {taxonomy?.paths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qgen-subject" className="block text-xs font-black text-slate-700 mb-1">
                  المادة
                </label>
                <select
                  id="qgen-subject"
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setSkillId('');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                >
                  <option value="">اختر المادة</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="qgen-skill" className="block text-xs font-black text-slate-700 mb-1">
                  المهارة المستهدفة (اختياري)
                </label>
                <select
                  id="qgen-skill"
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                >
                  <option value="">كل المهارات</option>
                  {skills.slice(0, 150).map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="qgen-prompt" className="block text-xs font-black text-slate-700 mb-1">
                وصف الاختبار أو التعليمات
              </label>
              <textarea
                id="qgen-prompt"
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="مثال: أنشئ 5 أسئلة قدرات كمي متوسطة الصعوبة حول النسبة والتناسب مع شرح مختصر للحل..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">
                <FileUp size={15} />
                <span>{file ? file.name : 'إرفاق صورة أو ملف مرجعي (اختياري)'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="submit"
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{generating ? 'جاري التوليد...' : 'توليد الأسئلة'}</span>
              </button>
            </div>
          </form>
        </header>

        {questions.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span>الأسئلة المولّدة ({questions.length})</span>
              {meta && (
                <span>
                  المزود: {meta.provider} ({meta.model}) — {meta.latencyMs}ms
                </span>
              )}
            </div>

            {questions.map((q, idx) => {
              const saved = savedIndexes.includes(idx);
              return (
                <article key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                      سؤال {idx + 1} — {q.difficulty || 'medium'}
                    </span>
                    <button
                      type="button"
                      disabled={saved || savingIndex === idx}
                      onClick={() => handleSaveToBank(q, idx)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black ${
                        saved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                      <span>
                        {saved
                          ? 'تم الحفظ في البنك'
                          : savingIndex === idx
                            ? 'جاري الحفظ...'
                            : 'حفظ في بنك الأسئلة'}
                      </span>
                    </button>
                  </div>

                  <p className="text-sm sm:text-base font-black text-slate-900 leading-relaxed">{q.text}</p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, optIdx) => (
                      <li
                        key={optIdx}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                          optIdx === q.correctAnswer
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-700">
                      <span className="font-black text-slate-900">الشرح: </span>
                      {q.explanation}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
