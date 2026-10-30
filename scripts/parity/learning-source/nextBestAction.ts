import { createHash } from "node:crypto";

export const ADAPTIVE_PATH_POLICY_VERSION = "2026-09-21.v1";

type SkillProgressRow = {
  skillId?: unknown;
  skill?: unknown;
  pathId?: unknown;
  subjectId?: unknown;
  sectionId?: unknown;
  mastery?: unknown;
  status?: unknown;
  attempts?: unknown;
  evidenceCount?: unknown;
  lastAttemptAt?: unknown;
  recentEvidence?: Array<{ mastery?: unknown; occurredAt?: unknown }>;
};

const asString = (value: unknown) => String(value || "").trim();
const asNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const resolveTrend = (row: SkillProgressRow): "improving" | "stable" | "declining" => {
  const recent = Array.isArray(row.recentEvidence)
    ? row.recentEvidence
        .map((item) => ({
          mastery: Math.max(0, Math.min(100, asNumber(item.mastery))),
          occurredAt: new Date(String(item.occurredAt || 0)).getTime() || 0,
        }))
        .filter((item) => item.occurredAt > 0)
        .sort((a, b) => a.occurredAt - b.occurredAt)
    : [];
  if (recent.length < 2) return "stable";
  const first = recent[0].mastery;
  const last = recent[recent.length - 1].mastery;
  if (last > first) return "improving";
  if (last < first) return "declining";
  return "stable";
};

const normalize = (row: SkillProgressRow) => {
  const mastery = Math.max(0, Math.min(100, asNumber(row.mastery)));
  const evidenceCount = Math.max(0, asNumber(row.evidenceCount || row.attempts));
  const lastAttemptAt = row.lastAttemptAt ? new Date(String(row.lastAttemptAt)).getTime() || 0 : 0;
  return {
    skillId: asString(row.skillId),
    skill: asString(row.skill) || "مهارة",
    pathId: asString(row.pathId),
    subjectId: asString(row.subjectId),
    sectionId: asString(row.sectionId),
    mastery,
    evidenceCount,
    status: asString(row.status),
    trend: resolveTrend(row),
    lastAttemptAt,
  };
};

const priorityScore = (row: ReturnType<typeof normalize>) => {
  const masteryNeed = 100 - row.mastery;
  const statusWeight = row.status === "weak" ? 30 : row.status === "average" ? 15 : 0;
  const trendWeight = row.trend === "declining" ? 18 : row.trend === "improving" ? -6 : 0;
  const insufficientEvidenceWeight = row.evidenceCount < 3 ? 12 : 0;
  const ageDays = row.lastAttemptAt > 0 ? (Date.now() - row.lastAttemptAt) / 86_400_000 : 0;
  const recencyWeight = Math.min(10, Math.max(0, ageDays / 14));
  return masteryNeed + statusWeight + trendWeight + insufficientEvidenceWeight + recencyWeight;
};

const actionFor = (row: ReturnType<typeof normalize>) => {
  if (row.evidenceCount < 3) return "measure";
  if (row.mastery >= 80) return "mastery_review";
  if (row.mastery < 50 || row.trend === "declining") return "alternate_support_then_recheck";
  return "remediation_then_recheck";
};

export const buildServerNextBestAction = (rows: SkillProgressRow[], scope: { pathId: string; subjectId?: string }) => {
  const ranked = rows
    .map(normalize)
    .filter((row) => row.skillId && row.pathId === scope.pathId && (!scope.subjectId || row.subjectId === scope.subjectId))
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  const fingerprintPayload = {
    version: ADAPTIVE_PATH_POLICY_VERSION,
    scope,
    rows: ranked.map((row) => ({
      skillId: row.skillId,
      subjectId: row.subjectId,
      mastery: row.mastery,
      evidenceCount: row.evidenceCount,
      trend: row.trend,
      lastAttemptAt: row.lastAttemptAt,
    })),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex").slice(0, 24);
  const candidates = ranked.slice(0, 4).map((row) => ({
    ...row,
    action: actionFor(row),
  }));

  return {
    version: ADAPTIVE_PATH_POLICY_VERSION,
    fingerprint,
    scope,
    nextAction: candidates[0] || null,
    candidates,
  };
};
