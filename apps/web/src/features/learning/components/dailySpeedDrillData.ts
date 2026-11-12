export interface SpeedDrillQuestion {
  id: string;
  question: string;
  category: 'كمي' | 'لفظي' | 'تحصيلي';
  skill: string;
  options: [string, string, string, string];
  correctAnswerIndex: number;
  speedTrick: string;
  targetSeconds: number;
}

export interface DailyDrillRecord {
  dateKey: string;
  completed: boolean;
  score: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  answers: number[];
  completedAt: number;
}

export const SPEED_DRILL_BANK: SpeedDrillQuestion[] = [
  {
    id: 'spd_q1',
    category: 'كمي',
    skill: 'حساب ذهني وتناسب',
    question: 'إذا كان ثمن 4 أقلام ودفتر = 14 ريال، وثمن 8 أقلام ودفترين = ؟',
    options: ['24 ريال', '28 ريال', '32 ريال', '26 ريال'],
    correctAnswerIndex: 1,
    speedTrick: 'تكتيك المضاعفة السريعة: ضرب الكميات كاملة في 2 مباشرة (14 × 2 = 28) دون حساب سعر القلم والدفتر منفرداً!',
    targetSeconds: 20,
  },
  {
    id: 'spd_q2',
    category: 'لفظي',
    skill: 'تناظر لفظي',
    question: 'غصن : شجرة',
    options: ['جذر : تربة', 'ورقة : كتاب', 'شارع : مدينة', 'شراع : سفينة'],
    correctAnswerIndex: 1,
    speedTrick: 'علاقة (جزء من كل): الغصن جزء من الشجرة، والورقة جزء من الكتاب. الإجابة فورية بأقل من 10 ثوانٍ!',
    targetSeconds: 15,
  },
  {
    id: 'spd_q3',
    category: 'كمي',
    skill: 'مقارنات سريعة',
    question: 'قارن بين: القيمة الأولى (0.40) والقيمة الثانية (2 / 5)',
    options: ['القيمة الأولى أكبر', 'القيمة الثانية أكبر', 'القيمتان متساويتان', 'المعطيات غير كافية'],
    correctAnswerIndex: 2,
    speedTrick: 'تحويل الكسر المألوف: 2/5 تكافئ دائماً 0.40 أو 40%؛ إذن القيمتان متساويتان فوراً دون قسمة مطولة!',
    targetSeconds: 15,
  },
  {
    id: 'spd_q4',
    category: 'لفظي',
    skill: 'إكمال الجمل',
    question: 'إن سر النجاح هو أن تكون مستعداً للـ (...) عندما تأتيك.',
    options: ['المكافأة', 'الفرصة', 'النتيجة', 'المغامرة'],
    correctAnswerIndex: 1,
    speedTrick: 'التوافق السياقي المشهور: مقولة شائعة في اختبارات قياس، الفرص تتطلب استعداداً مسبقاً لاستثمارها.',
    targetSeconds: 20,
  },
  {
    id: 'spd_q5',
    category: 'تحصيلي',
    skill: 'رياضيات - هندسة وإحداثيات',
    question: 'ما ميل المستقيم الموازي للمستقيم y = 3x - 5 ؟',
    options: ['-3', '3', '1/3', '-1/3'],
    correctAnswerIndex: 1,
    speedTrick: 'خاصية التوازي: المستقيمات المتوازية لها نفس الميل تماماً (m = 3). حل خاطف بالنظر!',
    targetSeconds: 15,
  },
  {
    id: 'spd_q6',
    category: 'كمي',
    skill: 'النسب المئوية السريعة',
    question: 'ما قيمة 15% من العدد 400؟',
    options: ['45', '50', '60', '75'],
    correctAnswerIndex: 2,
    speedTrick: 'تفكيك النسبة: 10% من 400 = 40، ونصفها 5% = 20، إذن 40 + 20 = 60 في ثانيتين فقط!',
    targetSeconds: 20,
  },
  {
    id: 'spd_q7',
    category: 'لفظي',
    skill: 'الخطأ السياقي',
    question: 'العظمة في هذه الحياة ليست في التعثر، بل في الاستسلام بعد كل عثرة.',
    options: ['الحياة', 'التعثر', 'الاستسلام', 'عثرة'],
    correctAnswerIndex: 2,
    speedTrick: 'عكس المعنى المنطقي: العظمة تكون في (النهوض) بعد كل عثرة، فكلمة الاستسلام هي الكلمة المعكوسة.',
    targetSeconds: 25,
  },
  {
    id: 'spd_q8',
    category: 'كمي',
    skill: 'متتابعات سريعة',
    question: 'أكمل المتتابعة التالية: 3 ، 7 ، 15 ، 31 ، (...)',
    options: ['47', '55', '63', '65'],
    correctAnswerIndex: 2,
    speedTrick: 'قاعدة (اضرب في 2 واجمع 1): 31 × 2 + 1 = 63، أو مضاعفة الفارق المتزايد (+4, +8, +16, +32).',
    targetSeconds: 25,
  },
  {
    id: 'spd_q9',
    category: 'تحصيلي',
    skill: 'فيزياء - تسارع وقوة',
    question: 'جسم كتلته 5 كجم يؤثر عليه قوة مقدارها 20 نيوتن، فما تسارعه؟',
    options: ['2 م/ث²', '4 م/ث²', '10 م/ث²', '100 م/ث²'],
    correctAnswerIndex: 1,
    speedTrick: 'قانون نيوتن الثاني المباشر: a = F / m = 20 / 5 = 4 م/ث² فوراً.',
    targetSeconds: 15,
  },
  {
    id: 'spd_q10',
    category: 'لفظي',
    skill: 'المفردة الشاذة',
    question: 'اختر الكلمة الشاذة من بين الآتي: (الأسد ، النمر ، الفهد ، الغزال)',
    options: ['الأسد', 'النمر', 'الفهد', 'الغزال'],
    correctAnswerIndex: 3,
    speedTrick: 'تصنيف المجموعات: الغزال حيوان عاشب، بينما البقية من الضواري آكلة اللحوم.',
    targetSeconds: 15,
  }
];

export const getTodayDateKey = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDailyQuestions = (dateKey = getTodayDateKey()): SpeedDrillQuestion[] => {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const startIndex = Math.abs(hash) % SPEED_DRILL_BANK.length;
  const selected: SpeedDrillQuestion[] = [];
  
  for (let i = 0; i < 5; i++) {
    const idx = (startIndex + i) % SPEED_DRILL_BANK.length;
    selected.push(SPEED_DRILL_BANK[idx]);
  }
  return selected;
};

export const getDailyDrillStorageKey = (userId: string, dateKey = getTodayDateKey()): string => {
  return `almeaa_speed_drill_${userId || 'guest'}_${dateKey}`;
};

export const loadDailyDrillRecord = (userId: string, dateKey = getTodayDateKey()): DailyDrillRecord | null => {
  try {
    const raw = localStorage.getItem(getDailyDrillStorageKey(userId, dateKey));
    if (!raw) return null;
    return JSON.parse(raw) as DailyDrillRecord;
  } catch {
    return null;
  }
};

export const saveDailyDrillRecord = (
  userId: string,
  record: Omit<DailyDrillRecord, 'completedAt'>,
): DailyDrillRecord => {
  const fullRecord: DailyDrillRecord = {
    ...record,
    completedAt: Date.now(),
  };
  try {
    localStorage.setItem(getDailyDrillStorageKey(userId, record.dateKey), JSON.stringify(fullRecord));
  } catch (err) {
    console.warn('Failed to save daily drill record', err);
  }
  return fullRecord;
};
