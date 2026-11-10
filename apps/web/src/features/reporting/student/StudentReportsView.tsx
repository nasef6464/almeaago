import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  RefreshCcw,
  Share2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
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
  scoreTone,
  studentReportPeriodLabels,
  buildStudentWeeklyPlan,
  buildStudentRemediationFallback,
  buildStudentReadinessDecision,
} from './studentReportDomain';
import type {
  StudentAggregatedSkill,
  StudentMasteryGoal,
  StudentPerformanceStats,
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
            skill: item.skillId || 'مهارة دراسية',
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

  // 3. Computed stats & highlights
  const stats = useMemo<StudentPerformanceStats>(() => {
    if (results.length > 0) {
      const totalScore = results.reduce((acc, r) => acc + (r.score || 0), 0);
      const averageScore = Math.round(totalScore / results.length);
      return {
        averageScore,
        bestSubject: { name: 'المسار الحالي', score: averageScore },
        worstSubject: { name: 'يحتاج تركيز', score: Math.max(0, averageScore - 15) },
        totalQuestions: results.reduce((acc, r) => acc + (r.correctAnswers + r.wrongAnswers), 0),
        uniqueSkills: skills.length,
      };
    }

    if (skills.length > 0) {
      const avg = Math.round(skills.reduce((acc, s) => acc + s.mastery, 0) / skills.length);
      const sorted = [...skills].sort((a, b) => b.mastery - a.mastery);
      return {
        averageScore: avg,
        bestSubject: { name: sorted[0]?.skill || 'مهارة متقنة', score: sorted[0]?.mastery || 0 },
        worstSubject: { name: sorted[sorted.length - 1]?.skill || 'مهارة تحتاج تركيز', score: sorted[sorted.length - 1]?.mastery || 0 },
        totalQuestions: skills.reduce((acc, s) => acc + s.totalEvidence, 0),
        uniqueSkills: skills.length,
      };
    }

    return {
      averageScore: 0,
      bestSubject: { name: '-', score: 0 },
      worstSubject: { name: '-', score: 0 },
      totalQuestions: 0,
      uniqueSkills: 0,
    };
  }, [results, skills]);

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

      {/* 2. Filter Bar (مسار، مادة، فترة زمنية) */}
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

      {/* 3. Main Decision Card (بطاقة القرار السريع وأهم المؤشرات) */}
      <section
        aria-label="تقرير مبسط للطالب"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-900 text-white p-6 shadow-xl transition-all"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-teal-300 opacity-15 rounded-full blur-2xl -ml-10 -mb-10" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1 text-xs font-black text-emerald-100 shadow-2xs mb-2.5">
                <Sparkles size={14} className="text-amber-300" />
                قراءة سريعة للتقرير
              </div>
              <h2 className="text-xl sm:text-2xl font-black leading-tight text-white">
                ابدأ بخطوة واحدة واضحة اليوم
              </h2>
              <p className="mt-2 max-w-3xl text-xs sm:text-sm font-medium leading-relaxed text-emerald-50">
                {studentFollowUpSummary}
              </p>
              <div className="mt-2 text-xs font-bold text-teal-200">
                فترة التحليل: {studentReportPeriodLabels[period]} - {skills.length} مهارة مرصودة
              </div>
            </div>

            <div className="print-hide flex flex-wrap gap-2 self-start">
              <button
                type="button"
                onClick={copyStudentSummary}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/25 px-3.5 py-2 text-xs font-black text-white transition"
              >
                {copiedSummary ? <CheckCircle size={15} /> : <Copy size={15} />}
                <span>{copiedSummary ? 'تم النسخ ✓' : 'نسخ الملخص'}</span>
              </button>
              <button
                type="button"
                onClick={shareStudentSummary}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-white/90 px-3.5 py-2 text-xs font-black text-emerald-950 transition shadow-xs"
              >
                {sharedSummary ? <CheckCircle size={15} /> : <Share2 size={15} />}
                <span>{sharedSummary ? 'تمت المشاركة' : 'مشاركة'}</span>
              </button>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
              <div className="text-xs font-bold text-teal-100">أهم مؤشر</div>
              <div className="mt-2 text-3xl font-black text-white">{stats.averageScore}%</div>
              <div className="mt-1 text-xs font-bold text-teal-100">متوسط الأداء</div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 sm:col-span-1">
              <div className="text-xs font-bold text-teal-100">أولوية المراجعة الآن</div>
              <div className="mt-2 text-lg sm:text-xl font-black leading-snug text-white truncate">
                {weakestSkill?.skill || 'لا توجد مهارة ضعيفة مؤكدة'}
              </div>
              <div className="mt-1 text-xs font-bold text-teal-100">
                {weakestSkill ? `نسبة الإتقان: ${weakestSkill.mastery}%` : 'نتائجك مطمئنة'}
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
              <div className="text-xs font-bold text-teal-100">حالة النتائج</div>
              <div className="mt-2 text-xl font-black text-white">
                {results.filter((r) => r.passed).length} ناجحة
              </div>
              <div className="mt-1 text-xs font-bold text-teal-100">
                من {results.length || skills.length} نتيجة
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Readiness Decision Banner */}
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
            className="self-start sm:self-center inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-xs sm:text-sm font-black text-white transition shadow-xs shrink-0"
          >
            <span>{readinessDecision.actionLabel}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* 5. Weekly Study Plan Panel */}
      <StudentWeeklyPlanPanel visible={true} items={weeklyPlan} />

      {/* 6. AI Smart Remediation Panel */}
      <StudentSmartRemediationPanel visible={true} plan={smartRemediation} />

      {/* 7. Skills Mastery Breakdown Matrix */}
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

        {/* Skills Cards Grid */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-12 text-center text-sm font-bold text-gray-400">
              <Loader2 size={24} className="mx-auto animate-spin text-indigo-600 mb-2" />
              جارٍ تحليل مؤشرات المهارات...
            </div>
          ) : filteredSkills.length > 0 ? (
            filteredSkills.map((skill) => {
              const tone = getReportMasteryTone(skill.mastery);
              const isSelected = selectedSkillKey === skill.skillId || selectedSkillKey === skill.skill;
              return (
                <button
                  key={`${skill.skillId || skill.skill}`}
                  type="button"
                  onClick={() => setSelectedSkillKey((prev) => (prev === (skill.skillId || skill.skill) ? null : skill.skillId || skill.skill))}
                  className={`text-right flex flex-col justify-between rounded-2xl border p-4 transition cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900 bg-indigo-50/40 dark:bg-slate-800 shadow-sm'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {skill.mastery}%
                      </span>
                    </div>

                    <h3 className="font-black text-sm text-gray-900 dark:text-white leading-snug line-clamp-2">
                      {displayText(skill.skill)}
                    </h3>

                    {skill.subjectName && (
                      <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-slate-400 truncate">
                        {displayText(skill.subjectName)}
                      </p>
                    )}

                    {/* Mastery Bar */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                        style={{ width: `${Math.max(5, Math.min(100, skill.mastery))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-slate-400 pt-2 border-t border-slate-200/50 dark:border-slate-700">
                    <span>{skill.totalEvidence} أدلة مرصودة</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">
                      {isSelected ? 'إخفاء التفاصيل' : 'فتح التأسيس والتدريب ←'}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-sm font-bold text-gray-400">
              لا توجد مهارات مسجلة تحت هذا الفلتر حالياً.
            </div>
          )}
        </div>
      </section>

      {/* 8. Mastery Goals Panel */}
      <StudentMasteryGoalsPanel
        goals={goals}
        loading={goalsLoading}
        onCreateShort={() => handleCreateGoal('short')}
        onCreateLong={() => handleCreateGoal('long')}
        onSetStatus={handleUpdateGoalStatus}
      />
    </ContainerTag>
  );
};
