import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Share2,
  Sparkles,
  Target,
  Video,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore, TaxonomyPath } from '../../content/api/content-types';
import { learningClient, type MasteryGoal, type MasteryReadiness, type SkillProgress } from '../../learning/api/learning-client';
import { reportingClient } from '../api/reporting-client';
import type { ReportingResult } from '../api/reporting-types';

import {
  displayText,
  getReportMasteryTone,
  printElementAsPdf,
  studentReportPeriodLabels,
  buildStudentWeeklyPlan,
  buildStudentRemediationFallback,
  buildStudentReadinessDecision,
} from './studentReportDomain';
import type {
  StudentAggregatedSkill,
  StudentMasteryGoal,
  StudentReportPeriod,
} from './studentReportTypes';

import { StudentWeeklyPlanPanel } from './StudentWeeklyPlanPanel';
import { StudentSmartRemediationPanel } from './StudentSmartRemediationPanel';
import { StudentSelectedSkillPanel } from './StudentSelectedSkillPanel';
import { StudentMasteryGoalsPanel } from './StudentMasteryGoalsPanel';

export const StudentReportsView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { user, getCsrfToken } = useAuth();
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [period, setPeriod] = useState<StudentReportPeriod>('month');
  const [depth, setDepth] = useState<'simple' | 'full'>('simple');
  const [skillFilter, setSkillFilter] = useState<'all' | 'weak' | 'average' | 'strong'>('all');
  const [showAllSkills, setShowAllSkills] = useState(false);

  const [skills, setSkills] = useState<StudentAggregatedSkill[]>([]);
  const [readiness, setReadiness] = useState<MasteryReadiness | null>(null);
  const [goals, setGoals] = useState<StudentMasteryGoal[]>([]);
  const [results, setResults] = useState<ReportingResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [goalsLoading, setGoalsLoading] = useState<boolean>(false);
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);

  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [sharedSummary, setSharedSummary] = useState<boolean>(false);

  // 1. Load taxonomy paths & subjects
  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyCore(controller.signal)
      .then((res) => {
        setTaxonomy(res);
        if (res.paths.length > 0 && !selectedPathId) {
          setSelectedPathId(res.paths[0].id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const availableSubjects = useMemo(() => {
    return taxonomy.subjects.filter((s) => !selectedPathId || s.pathId === selectedPathId);
  }, [selectedPathId, taxonomy.subjects]);

  // Reset subject filter if it doesn't belong to current path
  useEffect(() => {
    if (selectedSubjectId && !availableSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId('');
    }
  }, [availableSubjects, selectedSubjectId]);

  // 2. Fetch student progress, readiness, goals & results
  const loadReportsData = useCallback(async (signal?: AbortSignal) => {
    if (!selectedPathId) return;
    setLoading(true);
    try {
      const pathParam = selectedPathId || '';
      const subjectParam = selectedSubjectId || '';

      const [progressRes, readinessRes, goalsRes, resultsRes] = await Promise.allSettled([
        learningClient.progress(pathParam, subjectParam, 1, 100, signal),
        learningClient.readiness(pathParam, subjectParam, signal),
        learningClient.goals(pathParam, subjectParam, 'active', 1, 20, signal),
        reportingClient.results(
          {
            pathId: pathParam || undefined,
            subjectId: subjectParam || undefined,
          },
          1,
          50,
          signal,
        ),
      ]);

      // Map progress items to StudentAggregatedSkill
      if (progressRes.status === 'fulfilled') {
        const rawSkills: SkillProgress[] = progressRes.value.items || [];
        const mappedSkills: StudentAggregatedSkill[] = rawSkills.map((item) => {
          const matchedSubject = taxonomy.subjects.find((s) => s.id === item.subjectId);
          const mastery = Math.round(Number(item.mastery || 0));
          const status = mastery < 50 ? 'weak' : mastery < 75 ? 'average' : 'strong';
          return {
            skill: item.skillTitle || item.topicTitle || item.skillId || 'مهارة دراسية',
            skillId: item.skillId,
            pathId: item.pathId,
            subjectId: item.subjectId,
            subjectName: matchedSubject?.name,
            mastery,
            recentMastery: mastery,
            trend: item.trend || 'stable',
            confidence: item.evidenceCount >= 3 ? 90 : 50,
            attempts: item.attempts || item.evidenceCount || 1,
            correctAttempts: Math.round((mastery / 100) * (item.attempts || 1)),
            totalEvidence: item.evidenceCount || 1,
            isReliable: (item.evidenceCount || 0) >= 3,
            status,
          };
        });
        setSkills(mappedSkills);
      } else {
        setSkills([]);
      }

      if (readinessRes.status === 'fulfilled') {
        setReadiness(readinessRes.value.readiness);
      } else {
        setReadiness(null);
      }

      if (goalsRes.status === 'fulfilled') {
        const mappedGoals: StudentMasteryGoal[] = (goalsRes.value.items || []).map((g: MasteryGoal) => ({
          id: g.id,
          studentId: g.studentId,
          pathId: g.pathId,
          subjectId: g.subjectId,
          targetType: g.targetType,
          targetId: g.targetId,
          title: g.title,
          targetMastery: g.targetMastery,
          horizon: g.horizon,
          dueDate: g.dueDate ? new Date(g.dueDate).toLocaleDateString('ar-SA') : undefined,
          status: g.status,
        }));
        setGoals(mappedGoals);
      } else {
        setGoals([]);
      }

      if (resultsRes.status === 'fulfilled') {
        setResults(resultsRes.value.items || []);
      } else {
        setResults([]);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [selectedPathId, selectedSubjectId, taxonomy.subjects]);

  useEffect(() => {
    const controller = new AbortController();
    loadReportsData(controller.signal);
    return () => controller.abort();
  }, [loadReportsData]);

  // 3. Computed week summary (exactly three headline numbers)
  const weekSummary = useMemo(() => {
    // A reporting result is "completed" once it has been finalized.
    const completedResults = results.filter((result) => String(result.finalizedAt || '').trim().length > 0);
    const completedCount = completedResults.length;

    // Average score percent over the completed results only (null = no results yet).
    const rawAverage =
      completedCount > 0
        ? completedResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / completedCount
        : null;
    const averageScore = rawAverage === null ? null : Math.max(0, Math.min(100, Math.round(rawAverage)));

    // Skills measured = mastery rows returned by the progress endpoint for the active scope.
    const measuredSkills = skills.length;

    return { completedCount, averageScore, measuredSkills };
  }, [results, skills.length]);

  const weakestSkill = useMemo(() => {
    if (skills.length === 0) return null;
    return [...skills].sort((a, b) => a.mastery - b.mastery)[0];
  }, [skills]);

  const readinessDecision = useMemo(() => {
    return buildStudentReadinessDecision(readiness, weakestSkill);
  }, [readiness, weakestSkill]);

  const weeklyPlan = useMemo(() => {
    return buildStudentWeeklyPlan(skills);
  }, [skills]);

  const smartRemediation = useMemo(() => {
    return buildStudentRemediationFallback(skills);
  }, [skills]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillKey) return null;
    return skills.find((s) => s.skillId === selectedSkillKey || s.skill === selectedSkillKey) || null;
  }, [selectedSkillKey, skills]);

  const filteredSkills = useMemo(() => {
    if (skillFilter === 'all') return skills;
    return skills.filter((s) => s.status === skillFilter);
  }, [skillFilter, skills]);

  // Share and Copy handlers
  const studentFollowUpSummary = useMemo(() => {
    if (!weakestSkill) return 'ابدأ بحل اختبار تقييمي لتحديد المهارات التي تحتاج متابعة.';
    return `أولوية المراجعة الحالية: مهارة (${weakestSkill.skill}) بنسبة إتقان ${weakestSkill.mastery}%. يُنصح بمراجعة درس التأسيس وحل تدريب قياس لتثبيت المهارة.`;
  }, [weakestSkill]);

  const copyStudentSummary = async () => {
    if (!studentFollowUpSummary) return;
    try {
      await navigator.clipboard.writeText(studentFollowUpSummary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {}
  };

  const shareStudentSummary = async () => {
    if (!studentFollowUpSummary) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'تقرير أداء الطالب',
          text: studentFollowUpSummary,
        });
        setSharedSummary(true);
        setTimeout(() => setSharedSummary(false), 2000);
      } else {
        await copyStudentSummary();
      }
    } catch {}
  };

  // Export CSV
  const exportCsv = () => {
    if (skills.length === 0) return;
    const header = ['المهارة', 'المادة', 'نسبة الإتقان', 'الحالة', 'عدد الأدلة'];
    const rows = skills.map((s) => [
      s.skill,
      s.subjectName || '-',
      `${s.mastery}%`,
      s.status === 'weak' ? 'ضعيفة' : s.status === 'average' ? 'متوسطة' : 'متقنة',
      s.totalEvidence,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student-skills-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Goal actions
  const handleCreateGoal = async (horizon: 'short' | 'long') => {
    if (!selectedPathId) return;
    setGoalsLoading(true);
    try {
      const csrf = await getCsrfToken();
      await learningClient.createGoal(
        {
          pathId: selectedPathId,
          subjectId: selectedSubjectId || '',
          targetType: 'path',
          targetId: selectedPathId,
          title: horizon === 'short' ? 'إتقان مهارات هذا الأسبوع' : 'إتمام اختبارات المسار بدرجة 85%+',
          targetMastery: horizon === 'short' ? 80 : 90,
          horizon,
          dueDate: new Date(Date.now() + (horizon === 'short' ? 7 : 30) * 86400000).toISOString(),
        },
        csrf,
      );
      await loadReportsData();
    } catch {} finally {
      setGoalsLoading(false);
    }
  };

  const handleUpdateGoalStatus = async (goalId: string, status: 'achieved' | 'archived') => {
    setGoalsLoading(true);
    try {
      const targetGoal = goals.find((g) => g.id === goalId);
      if (!targetGoal) return;
      const csrf = await getCsrfToken();
      await learningClient.updateGoal(targetGoal as any, { status }, csrf);
      await loadReportsData();
    } catch {} finally {
      setGoalsLoading(false);
    }
  };

  const ContainerTag = embedded ? 'div' : 'main';

  return (
    <ContainerTag
      id="student-reports-print-area"
      dir="rtl"
      className={`space-y-6 animate-fade-in ${embedded ? 'w-full p-0' : 'mx-auto max-w-7xl px-4 py-8'}`}
    >
      {/* 1. Header with Export Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Link
              to="/dashboard"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition"
              aria-label="العودة للوحة الطالب"
            >
              <ArrowRight size={22} />
            </Link>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shadow-2xs">
                <BarChart3 size={18} />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                تقارير الأداء
              </h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400">
              تحليل ذكي لمستواك بناءً على نتائج تدريباتك ومحاولاتك السابقة
            </p>
          </div>
        </div>

        <div className="print-hide flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="student-report-export-pdf"
            onClick={() => printElementAsPdf('student-reports-print-area', 'تقرير أداء الطالب')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
          >
            <Download size={15} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            data-testid="student-report-export-excel"
            onClick={exportCsv}
            disabled={skills.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <FileSpreadsheet size={15} />
            <span>Excel / CSV</span>
          </button>

          <button
            type="button"
            data-testid="student-report-depth-toggle"
            onClick={() => setDepth((curr) => (curr === 'simple' ? 'full' : 'simple'))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Sparkles size={15} className="text-amber-500" />
            <span>{depth === 'full' ? 'عرض ملخص' : 'عرض تفصيلي'}</span>
          </button>
        </div>
      </header>

      {/* 2. ملخص الأسبوع: ثلاثة أرقام فقط */}
      <section
        aria-label="ملخص الأسبوع"
        data-testid="student-week-summary"
        className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300">
              <Calendar size={17} />
            </span>
            <h2 className="text-base font-black text-gray-900 dark:text-white sm:text-lg">ملخص الأسبوع</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            فترة العرض: {studentReportPeriodLabels[period]}
          </span>
        </div>

        <div className={`mt-4 grid grid-cols-3 ${loading ? 'animate-pulse' : ''}`}>
          <div className="px-1 text-center sm:px-3">
            <div className="text-3xl font-black leading-none tabular-nums text-indigo-700 dark:text-indigo-300 sm:text-4xl">
              {weekSummary.completedCount}
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
              اختبارات مكتملة
            </div>
          </div>
          <div className="border-s border-indigo-100 px-1 text-center dark:border-slate-800 sm:px-3">
            <div className="text-3xl font-black leading-none tabular-nums text-indigo-700 dark:text-indigo-300 sm:text-4xl">
              {weekSummary.averageScore === null ? '—' : `${weekSummary.averageScore}%`}
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
              متوسط الدرجة
            </div>
          </div>
          <div className="border-s border-indigo-100 px-1 text-center dark:border-slate-800 sm:px-3">
            <div className="text-3xl font-black leading-none tabular-nums text-indigo-700 dark:text-indigo-300 sm:text-4xl">
              {weekSummary.measuredSkills}
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
              مهارات مقاسة
            </div>
          </div>
        </div>
      </section>

      {/* 3. Filter Bar (مسار، مادة، فترة زمنية) */}
      <section className="print-hide rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-200 ml-1">
              <Filter size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>تضييق التقرير:</span>
            </div>

            {/* Path Selector */}
            <select
              aria-label="اختيار المسار"
              value={selectedPathId}
              onChange={(e) => setSelectedPathId(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-gray-100 focus:outline-hidden"
            >
              <option value="">كل المسارات</option>
              {taxonomy.paths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Subject Selector */}
            <select
              aria-label="اختيار المادة"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedPathId}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-gray-100 disabled:opacity-50 focus:outline-hidden"
            >
              <option value="">كل مواد المسار</option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['month', 'quarter', 'all'] as StudentReportPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {studentReportPeriodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. قراءة سريعة: توصية واحدة مع نسخ/مشاركة (بدون بطاقات مؤشرات مكررة) */}
      <section
        aria-label="قراءة سريعة للتقرير"
        className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 transition-colors dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Sparkles size={15} />
          </span>
          <p className="text-sm font-bold leading-7 text-emerald-950 dark:text-emerald-50">
            {studentFollowUpSummary}
          </p>
        </div>

        <div className="print-hide flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={copyStudentSummary}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"
          >
            {copiedSummary ? <CheckCircle size={15} /> : <Copy size={15} />}
            <span>{copiedSummary ? 'تم النسخ ✓' : 'نسخ الملخص'}</span>
          </button>
          <button
            type="button"
            onClick={shareStudentSummary}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800"
          >
            {sharedSummary ? <CheckCircle size={15} /> : <Share2 size={15} />}
            <span>{sharedSummary ? 'تمت المشاركة' : 'مشاركة'}</span>
          </button>
        </div>
      </section>

      {/* 5. Readiness Decision Banner */}
      <section
        data-testid="student-readiness-decision"
        className={`rounded-3xl border p-5 sm:p-6 shadow-sm transition-colors ${readinessDecision.cardClass}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${readinessDecision.badgeClass}`}>
                {readinessDecision.badge}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                {readinessDecision.evidence}
              </span>
            </div>
            <h3 className={`text-lg sm:text-xl font-black ${readinessDecision.textClass}`}>
              {readinessDecision.title}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm font-bold leading-6 text-gray-600 dark:text-slate-300">
              {readinessDecision.body}
            </p>
          </div>

          <Link
            to={readinessDecision.actionHref}
            onClick={() => {
              // The remediation plan now lives inside the closed "الأهداف والخطة" details,
              // so reveal it before the in-page anchor scrolls to #remediation-plan.
              if (readinessDecision.actionHref !== '#remediation-plan') return;
              const details = document.getElementById('student-goals-and-plan');
              if (details instanceof HTMLDetailsElement) details.open = true;
            }}
            className="self-start sm:self-center inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-xs sm:text-sm font-black text-white transition shadow-xs shrink-0"
          >
            <span>{readinessDecision.actionLabel}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* 6. Skills Mastery Breakdown Matrix */}
      <section className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-300 mb-1.5">
              <Award size={14} />
              خريطة المهارات والإتقان
            </div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
              تفاصيل إتقان مهارات المسار
            </h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              اضغط على أي مهارة لفتح مصادر التأسيس، وحل تدريب قياس مباشر عليها.
            </p>
          </div>

          {/* Skill Status Filter Pills */}
          <div className="print-hide flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSkillFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                skillFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              الكل ({skills.length})
            </button>
            <button
              type="button"
              onClick={() => setSkillFilter('weak')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                skillFilter === 'weak'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              تحتاج تركيز ({skills.filter((s) => s.status === 'weak').length})
            </button>
            <button
              type="button"
              onClick={() => setSkillFilter('average')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                skillFilter === 'average'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              متوسطة ({skills.filter((s) => s.status === 'average').length})
            </button>
            <button
              type="button"
              onClick={() => setSkillFilter('strong')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                skillFilter === 'strong'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              مطمئنة ({skills.filter((s) => s.status === 'strong').length})
            </button>
          </div>
        </div>

        {/* Selected Skill Drill-down Drawer */}
        {selectedSkill && (
          <StudentSelectedSkillPanel
            skill={selectedSkill}
            onClose={() => setSelectedSkillKey(null)}
          />
        )}

        {/* Skills Rows */}
        <div className="mt-5 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-gray-400">
              <Loader2 size={24} className="mx-auto animate-spin text-indigo-600 mb-2" />
              جارٍ تحليل مؤشرات المهارات...
            </div>
          ) : filteredSkills.length > 0 ? (
            filteredSkills.slice(0, showAllSkills ? filteredSkills.length : 8).map((skill) => {
              const tone = getReportMasteryTone(skill.mastery);
              const isSelected = selectedSkillKey === skill.skillId || selectedSkillKey === skill.skill;
              const base = skill.topicId && skill.pathId && skill.subjectId
                ? `/learning?path=${encodeURIComponent(skill.pathId)}&subject=${encodeURIComponent(skill.subjectId)}`
                : '';
              const videoLink = base ? `${base}&tab=skills&topic=${encodeURIComponent(skill.topicId!)}&content=lessons` : '';
              const drillLink = base ? `${base}&tab=questions&topic=${encodeURIComponent(skill.topicId!)}` : '';
              const supportLink = base ? `${base}&tab=skills&topic=${encodeURIComponent(skill.topicId!)}&content=support` : '';
              return (
                <div key={`${skill.skillId || skill.skill}`} className={`rounded-2xl border p-3 ${isSelected ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-gray-900 dark:text-white">{displayText(skill.skill)}</div>
                      {skill.subjectName && <div className="mt-0.5 truncate text-[11px] font-bold text-gray-500 dark:text-slate-400">{displayText(skill.subjectName)}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${tone.text}`}>{skill.mastery}%</span>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(4, Math.min(100, skill.mastery))}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {videoLink ? (
                        <Link to={videoLink} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"><Video size={12} />فيديو</Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-400" title="لا يوجد تأسيس مرتبط"><Video size={12} />فيديو</span>
                      )}
                      {drillLink ? (
                        <Link to={drillLink} className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-100"><FileText size={12} />تدريب</Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-400" title="لا يوجد تدريب مرتبط"><FileText size={12} />تدريب</span>
                      )}
                      {supportLink ? (
                        <Link to={supportLink} className="inline-flex items-center gap-1 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><BookOpen size={12} />ملف الدعم</Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-400" title="لا يوجد ملف دعم مرتبط"><BookOpen size={12} />ملف الدعم</span>
                      )}
                      <button type="button" onClick={() => setSelectedSkillKey((prev) => (prev === (skill.skillId || skill.skill) ? null : (skill.skillId || skill.skill)!))} className="rounded-xl px-2 py-1.5 text-[11px] font-black text-indigo-600 hover:underline">
                        {isSelected ? 'إخفاء' : 'تفاصيل'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-sm font-bold text-gray-400">
              لا توجد مهارات مسجلة تحت هذا الفلتر حالياً.
            </div>
          )}
          {!loading && filteredSkills.length > 8 && (
            <div className="pt-1 text-center">
              <button type="button" onClick={() => setShowAllSkills((v) => !v)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                {showAllSkills ? 'عرض أقل' : `عرض المزيد (${filteredSkills.length - 8})`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 7. الأهداف والخطة: مطوية افتراضيًا في أسفل الصفحة بعد صفوف المهارات */}
      <details
        id="student-goals-and-plan"
        data-testid="student-goals-and-plan"
        className="group rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Target size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-white sm:text-lg">الأهداف والخطة</h2>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
                خطة الأسبوع والخطة العلاجية وأهداف الإتقان — افتحها عند الحاجة
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 sm:text-xs">
            <span className="group-open:hidden">عرض</span>
            <span className="hidden group-open:inline">إخفاء</span>
            <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="space-y-5 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
          <StudentWeeklyPlanPanel visible={true} items={weeklyPlan} />
          <StudentSmartRemediationPanel visible={true} plan={smartRemediation} />
          <StudentMasteryGoalsPanel
            goals={goals}
            loading={goalsLoading}
            onCreateShort={() => handleCreateGoal('short')}
            onCreateLong={() => handleCreateGoal('long')}
            onSetStatus={handleUpdateGoalStatus}
          />
        </div>
      </details>
    </ContainerTag>
  );
};
