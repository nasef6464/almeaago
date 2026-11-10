export type ClassroomSessionStatus='draft'|'scheduled'|'live'|'ended'|'archived';
export type ClassroomPublishedMode='single'|'batch';
export type ClassroomAttendanceStatus='present'|'late'|'absent'|'excused';

export interface ClassroomSession{
 id:string;schoolId:string;classId:string;subjectId:string;teacherId:string;
 status:ClassroomSessionStatus;day:string;period:number|null;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;pinExpiresAt:string;revision:number;
 startedAt:string|null;endedAt:string|null;createdAt:string;updatedAt:string;
}
export interface ClassroomQuestionSummary{id:string;version:number;questionType:'mcq'|'true_false';text:string;difficulty:string}
export interface ClassroomQuestionPage{items:ClassroomQuestionSummary[];page:number;limit:number;hasMore:boolean}
export interface ClassroomOption{index:number;text:string;assetId:string}
export interface ClassroomLiveQuestion{
 ordinal:number;questionId:string;questionVersion:number;text:string;imageAssetId:string;imageAlt:string;
 optionsEmbeddedInImage:boolean;options:ClassroomOption[];difficulty:string;revealed:boolean;
 correctOptionIndex:number|null;explanation:string;selectedOptionIndex:number|null;
}
export interface ClassroomChallenge{
 sessionId:string;activeBatchId:string;competitionEnabled:boolean;challengeDurationSeconds:number|null;
 timerStartedAt:string|null;timerEndsAt:string|null;expired:boolean;serverNow:string;
}
export interface ClassroomStudentState{
 sessionId:string;status:ClassroomSessionStatus;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;questions:ClassroomLiveQuestion[];challenge:ClassroomChallenge|null;
}
export interface ClassroomQuestionAggregate{ordinal:number;questionId:string;responseCount:number;correctCount:number;distribution:Record<string,number>}
export interface ClassroomAggregate{
 sessionId:string;status:ClassroomSessionStatus;activeBatchId:string;activeQuestionOrdinal:number|null;
 joinedCount:number;questions:ClassroomQuestionAggregate[];
}
export interface ClassroomPresentation{
 sessionId:string;status:ClassroomSessionStatus;publishedMode:ClassroomPublishedMode;
 activeBatchId:string;activeQuestionOrdinal:number|null;questions:ClassroomLiveQuestion[];aggregate:ClassroomAggregate;
 challenge:ClassroomChallenge|null;
}
export interface ClassroomBatch{
 id:string;sessionId:string;batchNumber:number;label:string;startedAt:string|null;endedAt:string|null;createdAt:string;
 competitionEnabled:boolean;challengeDurationSeconds:number|null;timerStartedAt:string|null;timerEndsAt:string|null;
 questions:Array<{ordinal:number;batchId:string;questionId:string;questionVersion:number;publishedAt:string|null;revealedAt:string|null}>;
}
export interface SchoolContract{
 id:string;schoolId:string;status:'active'|'inactive'|'expired';modules:string[];
 validFrom:string|null;validUntil:string|null;revision:number;createdAt:string;updatedAt:string;
}
export interface ClassroomReport{
 sessionId:string;schoolId:string;classId:string;subjectId:string;teacherId:string;status:'ended';
 startedAt:string|null;endedAt:string|null;durationMinutes:number|null;
 roster:{expected:number;joined:number;absentFromSession:number;present:number;late:number;absent:number;excused:number};
 attendance:Array<{studentId:string;status:ClassroomAttendanceStatus;joinedAt:string|null;joinedMethod:string;attendanceOverriddenBy:string;attendanceOverriddenAt:string|null}>;
 batches:Array<{batchId:string;number:number;label:string;questionOrdinals:number[];startedAt:string|null;endedAt:string|null;totals:{answered:number;correct:number;wrong:number;unanswered:number;accuracy:number|null}}>;
 questions:Array<{ordinal:number;questionId:string;questionVersion:number;answered:number;correct:number;wrong:number;unanswered:number;distribution:Record<string,number>}>;
 totals:{responses:number;correct:number};
}

export interface ClassroomAttendanceRow{
 studentId:string;joinedAt:string|null;joinedMethod:string;attendanceStatus:ClassroomAttendanceStatus;
 attendanceOverriddenBy:string;attendanceOverriddenAt:string|null;
}
export interface ClassroomAttendance{
 sessionId:string;expected:number;joined:number;present:number;late:number;absent:number;excused:number;rows:ClassroomAttendanceRow[];
}
export interface ClassroomCompetitionStanding{
 rank:number;studentId:string;answered:number;correct:number;accuracy:number;score:number;lastSubmittedAt:string|null;
}
export interface ClassroomCompetition{
 state:ClassroomChallenge;participantCount:number;leaderboard:ClassroomCompetitionStanding[];podium:ClassroomCompetitionStanding[];
 scoring:{correctAnswerPoints:number;speedBonus:boolean};
}

// ==========================================
// Whiteboard Types (السبورة الذكية التفاعلية)
// ==========================================
export type WhiteboardTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'triangle' | 'coordinate_plane' | 'text' | 'formula';
export type WhiteboardTheme = 'white' | 'math_grid' | 'lined' | 'dark_chalkboard';

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardElement {
  id: string;
  tool: WhiteboardTool;
  color: string;
  strokeWidth: number;
  points?: WhiteboardPoint[];
  // For geometric shapes & text
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
  formula?: string;
  filled?: boolean;
}

export interface WhiteboardSnapshot {
  sessionId: string;
  timestamp: number;
  theme: WhiteboardTheme;
  elements: WhiteboardElement[];
}

// ==========================================
// xAPI (Experience API / Tin Can) Types
// ==========================================
export interface XAPIActor {
  name: string;
  account: {
    homePage: string;
    name: string;
  };
}

export interface XAPIVerb {
  id: string;
  display: Record<string, string>;
}

export interface XAPIObject {
  id: string;
  definition?: {
    name?: Record<string, string>;
    description?: Record<string, string>;
    type?: string;
  };
}

export interface XAPIResult {
  score?: {
    raw?: number;
    min?: number;
    max?: number;
    scaled?: number;
  };
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
}

export interface XAPIContext {
  contextActivities?: {
    category?: Array<{ id: string; definition?: { name?: Record<string, string> } }>;
    grouping?: Array<{ id: string; definition?: { name?: Record<string, string> } }>;
  };
  extensions?: Record<string, unknown>;
}

export interface XAPIStatement {
  id: string;
  timestamp: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
}

// ==========================================
// Quick Poll Types (التصويت والاستبيان الفوري)
// ==========================================
export type PollType = 'options_4' | 'options_2' | 'true_false' | 'open_vote';

export interface LivePollQuestion {
  id: string;
  type: PollType;
  prompt: string;
  options: string[];
  correctOptionIndex?: number | null;
  timeLimitSeconds: number;
  startedAt?: string;
}

// ==========================================
// Skill Mastery & Remedial Bridge
// ==========================================
export interface SkillMasteryStat {
  skillId: string;
  skillName: string;
  sectionName?: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  isWeak: boolean;
  targetStudentIds: string[];
}

