import type {
  StudentAggregatedSkill,
  StudentReportPeriod,
  StudentWeeklyPlanItem,
  SmartRemediationPlan,
  StudentReadinessDecision,
} from './studentReportTypes';
import type { MasteryReadiness } from '../../learning/api/learning-client';

export const MIN_SKILL_EVIDENCE_COUNT = 3;

export const displayText = (value?: string | null): string => {
  if (!value) return '';
  return String(value).trim();
};

export const studentReportPeriodLabels: Record<StudentReportPeriod, string> = {
  month: 'هذا الشهر',
  quarter: 'آخر 3 أشهر',
  all: 'كل الفترات',
};

export const getReportMasteryTone = (mastery: number) => {
  if (mastery < 50) {
    return {
      label: 'تحتاج تركيز وتأسيس',
      bg: 'bg-rose-50 dark:bg-rose-950/60',
      text: 'text-rose-700 dark:text-rose-300',
      bar: 'bg-rose-500',
      border: 'border-rose-100 dark:border-rose-900/60',
    };
  }

  if (mastery < 75) {
    return {
      label: 'راجعها قريبًا',
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-700 dark:text-amber-300',
      bar: 'bg-amber-500',
      border: 'border-amber-100 dark:border-amber-900/60',
    };
  }

  return {
    label: 'مطمئنة',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    border: 'border-emerald-100 dark:border-emerald-900/60',
  };
};

export const scoreTone = (score: number) => {
  if (score < 60) return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-900/60';
  if (score < 80) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-100 dark:border-amber-900/60';
  return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900/60';
};

export const buildStudentWeeklyPlan = (
  skills: StudentAggregatedSkill[],
): StudentWeeklyPlanItem[] => {
  const days = ['اليوم الأول', 'اليوم الثاني', 'اليوم الثالث'];
  const weakest = [...skills].sort((a, b) => a.mastery - b.mastery).slice(0, 3);

  return weakest.map((skill, index) => {
    const isWeak = skill.mastery < 50;
    return {
      day: days[index] || `اليوم ${index + 1}`,
      skill: skill.skill,
      skillId: skill.skillId,
      pathId: skill.pathId,
      subjectId: skill.subjectId,
      sectionId: skill.sectionId,
      subjectName: skill.subjectName,
      sectionName: skill.sectionName,
      mastery: skill.mastery,
      actionText: isWeak
        ? 'ابدأ بمراجعة شرح المهارة من التأسيس ثم حل 5 أسئلة تدريبية.'
        : 'تدريب سريع لتثبيت الإتقان والانتقال للمستوى الأعلى.',
      lessonTitle: `تأسيس ${skill.skill}`,
      lessonTopicTitle: skill.sectionName || skill.subjectName,
      lessonLink: skill.pathId ? `/category/${skill.pathId}?subject=${skill.subjectId || ''}` : '/dashboard?tab=paths',
      quizTitle: `تدريب قياس: ${skill.skill}`,
      quizLink: skill.pathId ? `/dashboard?tab=assessments&pathId=${skill.pathId}&subjectId=${skill.subjectId || ''}` : '/dashboard?tab=assessments',
    };
  });
};

export const buildStudentRemediationFallback = (
  skills: StudentAggregatedSkill[],
): SmartRemediationPlan => {
  const weakest = [...skills].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const lead = weakest[0];

  return {
    title: lead ? `خطة تركيز على مهارة: ${lead.skill}` : 'خطة علاجية قصيرة للأسبوع الحالي',
    summary: 'ابدأ بأضعف مهارة تظهر في نتائجك، راجع شرحها في التأسيس، ثم حل تدريبًا قصيرًا وأعد القياس للتأكد من ارتفاع نسبة الإتقان.',
    steps: weakest.map((skill, index) => ({
      day: `اليوم ${index + 1}`,
      skill: skill.skill,
      action: `مراجعة درس التأسيس الخاص بمهارة (${skill.skill}) وحل 5 أسئلة نموذجية.`,
      check: `إجراء اختبار قصير والتأكد من وصول نسبة الإتقان إلى 75% أو أكثر.`,
    })),
    parentNote: 'متابعة خطة الطالب والتركيز على إكمال تمرين واحد يوميًا يرفع مستوى الجاهزية بشكل ملحوظ.',
  };
};

export const buildStudentReadinessDecision = (
  readiness?: MasteryReadiness | null,
  leadSkill?: StudentAggregatedSkill | null,
): StudentReadinessDecision => {
  if (!readiness || readiness.status === 'needs_measurement') {
    return {
      status: 'needsMeasurement',
      readyToAdvance: false,
      badge: 'قرار الجاهزية',
      title: 'جاهز للاختبار الفعلي؟ نحتاج قياسًا قصيرًا أولًا',
      body: 'حل اختبارًا تدريبيًا لتحديد مستوى إتقانك بدقة وتوليد خطة مخصصة لك.',
      evidence: 'بيانات التقييم قيد التجميع',
      actionLabel: 'ابدأ اختبار تقييمي',
      actionHref: '/dashboard?tab=assessments',
      cardClass: 'border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/80 dark:bg-indigo-950/40',
      badgeClass: 'bg-indigo-600 text-white',
      textClass: 'text-indigo-950 dark:text-indigo-200',
      iconKey: 'target',
    };
  }

  if (readiness.status === 'ready_to_advance' || readiness.score >= 80) {
    return {
      status: 'readyToAdvance',
      readyToAdvance: true,
      badge: 'مستوى متقدم',
      title: 'مستواك ممتاز ومؤشراتك مطمئنة للاختبار!',
      body: 'حققت نسبة تغطية عالية وإتقانًا مستقرًا في المهارات الأساسية. حافظ على هذا المستوى بحل نماذج محاكية.',
      evidence: `نسبة الجاهزية: ${readiness.score}% - موثوقية عالية`,
      actionLabel: 'اختبار محاكي كامل',
      actionHref: '/dashboard?tab=assessments',
      cardClass: 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-950/40',
      badgeClass: 'bg-emerald-600 text-white',
      textClass: 'text-emerald-950 dark:text-emerald-200',
      iconKey: 'checkCircle',
    };
  }

  if (readiness.status === 'ready_for_recheck') {
    return {
      status: 'needsPractice',
      readyToAdvance: false,
      badge: 'جاهز للتحقق',
      title: 'أحسنت! حان وقت إعادة القياس لتثبيت الدرجة',
      body: `أنجزت تدريبات المهارات. أجرِ قياسًا سريعًا للتأكد من استقرار المهارة المستهدفة (${leadSkill?.skill || 'المهارة الأساسية'}).`,
      evidence: `نسبة الجاهزية: ${readiness.score}%`,
      actionLabel: 'إعادة القياس الآن',
      actionHref: '/dashboard?tab=assessments',
      cardClass: 'border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/40',
      badgeClass: 'bg-amber-600 text-white',
      textClass: 'text-amber-950 dark:text-amber-200',
      iconKey: 'fileText',
    };
  }

  return {
    status: 'needsRemediation',
    readyToAdvance: false,
    badge: 'يحتاج تركيز',
    title: 'ركّز على سد فجوات المهارات قبل موعد الاختبار',
    body: `لديك مهارات تحتاج تثبيتًا وتأسيسًا (${leadSkill?.skill || 'المهارات ذات الإتقان الأقل'}). ننصح بالبدء بالخطة العلاجية أدناه.`,
    evidence: `نسبة الجاهزية الحالية: ${readiness.score}%`,
    actionLabel: 'ابدأ بالخطة العلاجية',
    actionHref: '#remediation-plan',
    cardClass: 'border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/40',
    badgeClass: 'bg-rose-600 text-white',
    textClass: 'text-rose-950 dark:text-rose-200',
    iconKey: 'bookOpen',
  };
};

export const printElementAsPdf = (elementId: string, title: string) => {
  if (typeof window === 'undefined') return;
  const originalTitle = document.title;
  document.title = title;
  window.print();
  document.title = originalTitle;
};
