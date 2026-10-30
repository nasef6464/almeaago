export const SUPPORT_MASTERY_THRESHOLD = 75;

export const mergeSkillMasteryEvidence = ({
  previousMastery,
  previousEvidence,
  currentMastery,
  currentEvidence,
}: {
  previousMastery: number;
  previousEvidence: number;
  currentMastery: number;
  currentEvidence: number;
}) => {
  const safePreviousMastery = Math.max(0, Math.min(100, Number(previousMastery || 0)));
  const safeCurrentMastery = Math.max(0, Math.min(100, Number(currentMastery || 0)));
  const safePreviousEvidence = Math.max(0, Number(previousEvidence || 0));
  const safeCurrentEvidence = Math.max(1, Number(currentEvidence || 1));
  const evidenceCount = safePreviousEvidence + safeCurrentEvidence;
  const mastery = Math.round(
    ((safePreviousMastery * safePreviousEvidence) + (safeCurrentMastery * safeCurrentEvidence)) /
      Math.max(evidenceCount, 1),
  );

  return { mastery, evidenceCount };
};

export const buildRecommendedAction = (mastery: number, attemptCount: number) => {
  if (mastery < 45) {
    return "خطة علاج عاجلة: شرح + تدريب + اختبار موجه";
  }

  if (mastery < 65) {
    return attemptCount >= 3 ? "زيادة التدريب ثم اختبار ساهر علاجي" : "إضافة تدريب قصير ومتابعة الأداء";
  }

  return "تثبيت المهارة بتدريب خفيف وإعادة قياس لاحقًا";
};

export const buildSkillStatus = (mastery: number) => {
  if (mastery >= 90) return "mastered";
  if (mastery >= SUPPORT_MASTERY_THRESHOLD) return "good";
  if (mastery >= 50) return "average";
  return "weak";
};

export const buildResultSkillStatus = (mastery: number) => {
  if (mastery >= 80) return "strong";
  if (mastery >= 50) return "average";
  return "weak";
};

export const buildSkillRecommendation = (mastery: number) => {
  if (mastery < 50) return "راجع شرحًا قصيرًا ثم حل تدريبًا موجّهًا على نفس المهارة";
  if (mastery < 80) return "أداؤك قريب من الإتقان. زد التدريب قليلًا ثم أعد القياس";
  return "أداء ممتاز. حافظ على المهارة بتدريب خفيف من وقت لآخر";
};


export const DEFAULT_RECENT_EVIDENCE_WINDOW = 5;

export type RecentSkillEvidence = {
  sourceId: string;
  mastery: number;
  evidenceCount: number;
  occurredAt: Date;
};

export const mergeRecentSkillEvidence = ({
  previous,
  current,
  windowSize = DEFAULT_RECENT_EVIDENCE_WINDOW,
}: {
  previous: RecentSkillEvidence[];
  current: RecentSkillEvidence;
  windowSize?: number;
}) => {
  const boundedWindow = Math.max(
    1,
    Math.min(20, Math.floor(Number(windowSize || DEFAULT_RECENT_EVIDENCE_WINDOW))),
  );
  const bySource = new Map<string, RecentSkillEvidence>();

  [...previous, current].forEach((item) => {
    const sourceId = String(item?.sourceId || "").trim();
    if (!sourceId) return;
    const occurredAt = new Date(item.occurredAt || new Date());
    bySource.set(sourceId, {
      sourceId,
      mastery: Math.max(0, Math.min(100, Number(item.mastery || 0))),
      evidenceCount: Math.max(1, Number(item.evidenceCount || 1)),
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    });
  });

  return [...bySource.values()]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, boundedWindow);
};

export const summarizeRecentSkillEvidence = (items: RecentSkillEvidence[]) => {
  const normalized = items
    .map((item) => ({
      sourceId: String(item?.sourceId || ""),
      mastery: Math.max(0, Math.min(100, Number(item?.mastery || 0))),
      evidenceCount: Math.max(1, Number(item?.evidenceCount || 1)),
      occurredAt: new Date(item?.occurredAt || new Date()),
    }))
    .filter((item) => !Number.isNaN(item.occurredAt.getTime()));

  const evidenceCount = normalized.reduce((sum, item) => sum + item.evidenceCount, 0);
  const mastery = evidenceCount > 0
    ? Math.round(
        normalized.reduce((sum, item) => sum + item.mastery * item.evidenceCount, 0) /
          evidenceCount,
      )
    : 0;
  const chronological = [...normalized].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const oldest = chronological[0]?.mastery ?? mastery;
  const latest = chronological.at(-1)?.mastery ?? mastery;
  const trend =
    chronological.length < 2
      ? "stable"
      : latest > oldest
        ? "improving"
        : latest < oldest
          ? "declining"
          : "stable";

  return {
    mastery,
    evidenceCount,
    sampleSize: normalized.length,
    trend: trend as "improving" | "stable" | "declining",
  };
};
