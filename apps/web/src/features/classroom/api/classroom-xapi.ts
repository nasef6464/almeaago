import type { XAPIStatement, XAPIVerb } from './classroom-types';

const VERBS = {
  joined: {
    id: 'http://adlnet.gov/expapi/verbs/launched',
    display: { 'ar-SA': 'انضم للحصة الذكية', 'en-US': 'launched' },
  },
  answered: {
    id: 'http://adlnet.gov/expapi/verbs/answered',
    display: { 'ar-SA': 'أجاب على السؤال', 'en-US': 'answered' },
  },
  interacted: {
    id: 'http://adlnet.gov/expapi/verbs/interacted',
    display: { 'ar-SA': 'تفاعل مع السبورة الذكية', 'en-US': 'interacted' },
  },
  raisedHand: {
    id: 'http://adlnet.gov/expapi/verbs/requested',
    display: { 'ar-SA': 'رفع اليد للمشاركة', 'en-US': 'requested' },
  },
  mastered: {
    id: 'http://adlnet.gov/expapi/verbs/mastered',
    display: { 'ar-SA': 'أتقن المهارة', 'en-US': 'mastered' },
  },
  completed: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'ar-SA': 'أنهى الحصة التفاعلية', 'en-US': 'completed' },
  },
} satisfies Record<string, XAPIVerb>;

class XapiLogger {
  private statements: XAPIStatement[] = [];
  private readonly storageKeyPrefix = 'almeaa:xapi:';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = sessionStorage.getItem(`${this.storageKeyPrefix}classroom`);
      if (saved) {
        this.statements = JSON.parse(saved);
      }
    } catch {
      this.statements = [];
    }
  }

  private persist() {
    try {
      sessionStorage.setItem(
        `${this.storageKeyPrefix}classroom`,
        JSON.stringify(this.statements.slice(-100))
      );
    } catch {
      // quota or private mode fallback
    }
  }

  public recordStatement(stmt: Omit<XAPIStatement, 'id' | 'timestamp'>): XAPIStatement {
    const fullStatement: XAPIStatement = {
      id: `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...stmt,
    };
    this.statements.push(fullStatement);
    this.persist();
    return fullStatement;
  }

  public recordJoin(sessionId: string, studentId: string, studentName: string, method = 'pin') {
    return this.recordStatement({
      actor: {
        name: studentName,
        account: { homePage: 'https://almeaa.com/users', name: studentId },
      },
      verb: VERBS.joined,
      object: {
        id: `https://almeaa.com/classroom/sessions/${sessionId}`,
        definition: {
          name: { 'ar-SA': `حصة تفاعلية #${sessionId}` },
          type: 'http://adlnet.gov/expapi/activities/course',
        },
      },
      result: { completion: true, response: method },
    });
  }

  public recordAnswer(
    sessionId: string,
    studentId: string,
    studentName: string,
    questionOrdinal: number,
    selectedOption: number,
    isCorrect?: boolean,
    durationMs?: number
  ) {
    return this.recordStatement({
      actor: {
        name: studentName,
        account: { homePage: 'https://almeaa.com/users', name: studentId },
      },
      verb: VERBS.answered,
      object: {
        id: `https://almeaa.com/classroom/sessions/${sessionId}/questions/${questionOrdinal}`,
        definition: {
          name: { 'ar-SA': `سؤال #${questionOrdinal + 1}` },
          type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
        },
      },
      result: {
        response: String(selectedOption),
        success: isCorrect,
        completion: true,
        duration: durationMs ? `PT${Math.round(durationMs / 1000)}S` : undefined,
      },
    });
  }

  public recordWhiteboardInteraction(sessionId: string, actorName: string, actionDesc: string) {
    return this.recordStatement({
      actor: {
        name: actorName,
        account: { homePage: 'https://almeaa.com/users', name: 'actor' },
      },
      verb: VERBS.interacted,
      object: {
        id: `https://almeaa.com/classroom/sessions/${sessionId}/whiteboard`,
        definition: {
          name: { 'ar-SA': 'السبورة الذكية التفاعلية' },
          description: { 'ar-SA': actionDesc },
          type: 'http://adlnet.gov/expapi/activities/media',
        },
      },
    });
  }

  public recordCompletion(
    sessionId: string,
    actorId: string,
    actorName: string,
    accuracy: number,
    totalAnswered: number
  ) {
    return this.recordStatement({
      actor: {
        name: actorName,
        account: { homePage: 'https://almeaa.com/users', name: actorId },
      },
      verb: VERBS.completed,
      object: {
        id: `https://almeaa.com/classroom/sessions/${sessionId}`,
        definition: {
          name: { 'ar-SA': 'الحصة الذكية المكتملة' },
          type: 'http://adlnet.gov/expapi/activities/assessment',
        },
      },
      result: {
        completion: true,
        score: {
          scaled: accuracy / 100,
          raw: accuracy,
          min: 0,
          max: 100,
        },
        response: `${totalAnswered} إجابات مسجلة`,
      },
    });
  }

  public getStatements(sessionId?: string): XAPIStatement[] {
    if (!sessionId) return [...this.statements];
    return this.statements.filter((s) => s.object.id.includes(sessionId));
  }

  public exportJson(sessionId?: string): string {
    return JSON.stringify(this.getStatements(sessionId), null, 2);
  }
}

export const xapi = new XapiLogger();
