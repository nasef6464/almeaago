/**
 * Packages, Memberships & Hybrid Access Domain Types and Engine
 *
 * Implements the Saudi EdTech gold-standard 4-tier model with hybrid union access
 * for B2B school-sponsored students and B2C individual direct subscribers.
 */

export type MembershipTierId = 'free_starter' | 'smart_foundation' | 'golden_excellence' | 'diamond_vip';

export type BillingCycle = 'monthly' | 'term_3m' | 'semi_annual_6m' | 'annual';

export interface BillingCycleConfig {
  id: BillingCycle;
  label: string;
  shortLabel: string;
  months: number;
  discountPercent: number;
  badge?: string;
}

export const BILLING_CYCLES: Record<BillingCycle, BillingCycleConfig> = {
  monthly: {
    id: 'monthly',
    label: 'شهري (شهر واحد)',
    shortLabel: 'شهرياً',
    months: 1,
    discountPercent: 0,
  },
  term_3m: {
    id: 'term_3m',
    label: 'فصلي (3 أشهر)',
    shortLabel: '3 أشهر',
    months: 3,
    discountPercent: 15,
    badge: 'توفير 15%',
  },
  semi_annual_6m: {
    id: 'semi_annual_6m',
    label: 'نصف سنوي (6 أشهر)',
    shortLabel: '6 أشهر',
    months: 6,
    discountPercent: 25,
    badge: 'توفير 25%',
  },
  annual: {
    id: 'annual',
    label: 'سنوي شامل (12 شهراً)',
    shortLabel: 'سنوياً',
    months: 12,
    discountPercent: 35,
    badge: 'وفّر 35% 🔥',
  },
};

export interface MembershipTierFeatures {
  maxQuestionsPerDay: number;
  foundationCourses: boolean;
  questionBankFull: boolean;
  recentCollections: boolean;
  mockExamsUnlimited: boolean;
  qiyasStrictSectionLock: boolean;
  skillsGapRadar: boolean;
  allPathsIncluded: boolean;
  aiTutorUnlimited: boolean;
  whiteboardVoiceSolver: boolean;
  parentSmartReports: boolean;
  liveTutoringSessions: boolean;
}

export interface MembershipTier {
  id: MembershipTierId;
  name: string;
  badge: string;
  targetAudience: string;
  description: string;
  popularTag?: string;
  colorTheme: {
    border: string;
    bg: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    gradient: string;
    button: string;
  };
  pricing: Record<BillingCycle, number>;
  defaultAllowedPaths: string[];
  features: MembershipTierFeatures;
  highlights: string[];
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'free_starter',
    name: 'التجربة المجانية (Free Starter)',
    badge: 'مجاني للجميع',
    targetAudience: 'الطلاب المستكشفون وبداية التعرف على المنصة',
    description: 'الدروس التمهيدية مع 10 أسئلة يومياً واختبار تشخيصي أولي لتحديد المستوى.',
    colorTheme: {
      border: 'border-slate-200',
      bg: 'bg-white',
      text: 'text-slate-800',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-700',
      gradient: 'from-slate-500 to-slate-700',
      button: 'bg-slate-800 hover:bg-slate-900 text-white',
    },
    pricing: {
      monthly: 0,
      term_3m: 0,
      semi_annual_6m: 0,
      annual: 0,
    },
    defaultAllowedPaths: [],
    features: {
      maxQuestionsPerDay: 10,
      foundationCourses: false,
      questionBankFull: false,
      recentCollections: false,
      mockExamsUnlimited: false,
      qiyasStrictSectionLock: false,
      skillsGapRadar: false,
      allPathsIncluded: false,
      aiTutorUnlimited: false,
      whiteboardVoiceSolver: false,
      parentSmartReports: false,
      liveTutoringSessions: false,
    },
    highlights: [
      'اختبار تشخيصي أولي لقياس المستوى',
      '10 أسئلة يومياً من بنك الأسئلة مجاناً',
      'الدروس التمهيدية لكل مادة',
      'تصفح تصنيفات المعايير والمؤشرات',
    ],
  },
  {
    id: 'smart_foundation',
    name: 'باقة التأسيس الذكي (Smart Foundation)',
    badge: 'تأسيس مكثف ⚡',
    targetAudience: 'الطلاب الراغبون في بناء الأساس المتين وإتقان القوانين والمفاهيم',
    description: 'تأسيس كامل لمسار مختار مع فيديوهات تفاعلية وبنك أسئلة المهارات واختبارات قصيرة.',
    colorTheme: {
      border: 'border-blue-300',
      bg: 'bg-blue-50/30',
      text: 'text-blue-950',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      gradient: 'from-blue-600 to-cyan-600',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    pricing: {
      monthly: 69,
      term_3m: 149,
      semi_annual_6m: 239,
      annual: 349,
    },
    defaultAllowedPaths: ['qudurat_general'],
    features: {
      maxQuestionsPerDay: Infinity,
      foundationCourses: true,
      questionBankFull: true,
      recentCollections: false,
      mockExamsUnlimited: false,
      qiyasStrictSectionLock: false,
      skillsGapRadar: true,
      allPathsIncluded: false,
      aiTutorUnlimited: false,
      whiteboardVoiceSolver: false,
      parentSmartReports: false,
      liveTutoringSessions: false,
    },
    highlights: [
      'تأسيس كامل وشامل للمسار المختار (قدرات أو تحصيلي)',
      'فيديوهات تفاعلية بأسئلة وقفات ذكية',
      'بنك أسئلة غير محدود للمسار',
      'اختبارات قصيرة بعد كل درس مع حفظ السجل',
    ],
  },
  {
    id: 'golden_excellence',
    name: 'باقة التميز والمحاكيات (Golden Excellence)',
    badge: 'الأكثر اختياراً ⭐',
    popularTag: 'الأكثر طلباً للـ +90 🌟',
    targetAudience: 'الطلاب المستعدون للاختبار النهائي والطامحون لكسر حاجز الـ 90+',
    description: 'مسار القدرات والتحصيلي كاملاً مع محاكيات قياس غير المحدودة وقفل الأقسام الصارم والتجميعات.',
    colorTheme: {
      border: 'border-indigo-400',
      bg: 'bg-indigo-50/40',
      text: 'text-indigo-950',
      badgeBg: 'bg-indigo-100',
      badgeText: 'text-indigo-800',
      gradient: 'from-indigo-600 via-indigo-700 to-purple-600',
      button: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30',
    },
    pricing: {
      monthly: 99,
      term_3m: 199,
      semi_annual_6m: 249,
      annual: 379,
    },
    defaultAllowedPaths: ['qudurat_general', 'tahsili_science'],
    features: {
      maxQuestionsPerDay: Infinity,
      foundationCourses: true,
      questionBankFull: true,
      recentCollections: true,
      mockExamsUnlimited: true,
      qiyasStrictSectionLock: true,
      skillsGapRadar: true,
      allPathsIncluded: false,
      aiTutorUnlimited: false,
      whiteboardVoiceSolver: true,
      parentSmartReports: false,
      liveTutoringSessions: false,
    },
    highlights: [
      'كل ميزات باقة التأسيس كاملة',
      'محاكيات قياس حقيقية غير محدودة بنظام قفل الأقسام 25 دقيقة',
      'أحدث التجميعات المحدثة والمصنفة للعام الحالي',
      'رادار الفجوات المهارية وربطه التلقائي بدروس التأسيس',
      'مشغل الشرح الصوتي للسبورة خطوة بخطوة 🎙️',
    ],
  },
  {
    id: 'diamond_vip',
    name: 'عضوية VIP الماسية (Diamond VIP Pass)',
    badge: 'VIP شاملة 👑',
    popularTag: 'الدرجة الكاملة (100) 💎',
    targetAudience: 'الطلاب المتفوقون والمجمعات التعليمية للوصول لأعلى المراتب',
    description: 'وصول شامل لجميع مسارات المنصة + المعلم الذكي والسبورة بلا حدود + حصص البث المباشر وتقارير ولي الأمر.',
    colorTheme: {
      border: 'border-amber-400',
      bg: 'bg-amber-50/50',
      text: 'text-amber-950',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-900',
      gradient: 'from-amber-500 via-amber-600 to-yellow-500',
      button: 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white shadow-amber-500/40',
    },
    pricing: {
      monthly: 149,
      term_3m: 299,
      semi_annual_6m: 359,
      annual: 399,
    },
    defaultAllowedPaths: ['qudurat_general', 'tahsili_science', 'tahsili_arts', 'nafis_national'],
    features: {
      maxQuestionsPerDay: Infinity,
      foundationCourses: true,
      questionBankFull: true,
      recentCollections: true,
      mockExamsUnlimited: true,
      qiyasStrictSectionLock: true,
      skillsGapRadar: true,
      allPathsIncluded: true,
      aiTutorUnlimited: true,
      whiteboardVoiceSolver: true,
      parentSmartReports: true,
      liveTutoringSessions: true,
    },
    highlights: [
      'جميع مسارات المنصة (قدرات عامة + تحصيلي علمي وأدبي + نافس الوطنية)',
      'المعلم الذكي الفوري والسبورة الصوتية التفاعلية بلا أي حدود',
      'محاكيات قياس غير محدودة بجميع النماذج السرية والحديثة',
      'حصص تقوية وبث مباشر تفاعلي ليلة الاختبار مع كبار المدربين',
      'تقارير أسبوعية تفصيلية لولي الأمر عبر واتساب والمنصة',
      'أولوية الدعم الفني وتوجيه أكاديمي مخصص',
    ],
  },
];

export interface TierPriceCalculation {
  tierId: MembershipTierId;
  cycle: BillingCycle;
  price: number;
  monthlyEquivalent: number;
  savingsPercent: number;
  periodLabel: string;
}

export function calculateTierPrice(tierId: MembershipTierId, cycle: BillingCycle): TierPriceCalculation {
  const tier = MEMBERSHIP_TIERS.find((t) => t.id === tierId) || MEMBERSHIP_TIERS[0];
  const cycleConfig = BILLING_CYCLES[cycle];
  const price = tier.pricing[cycle];
  const monthlyEquivalent = Math.round(price / cycleConfig.months);

  // Calculate savings compared to paying the base monthly price every month
  const baseMonthlyCost = tier.pricing.monthly * cycleConfig.months;
  let savingsPercent = 0;
  if (baseMonthlyCost > 0 && price < baseMonthlyCost) {
    savingsPercent = Math.round(((baseMonthlyCost - price) / baseMonthlyCost) * 100);
  } else if (cycleConfig.discountPercent > 0) {
    savingsPercent = cycleConfig.discountPercent;
  }

  return {
    tierId,
    cycle,
    price,
    monthlyEquivalent,
    savingsPercent,
    periodLabel: cycleConfig.label,
  };
}

export function formatSaudiRiyal(amount: number): string {
  if (amount === 0) return 'مجاناً';
  return `${amount.toLocaleString('ar-SA')} ر.س`;
}

export interface SchoolContractContext {
  schoolName: string;
  allowedPaths: string[];
  modules?: string[];
  validUntil?: string;
  logoUrl?: string;
}

export interface IndividualEntitlement {
  tierId: MembershipTierId;
  validUntil?: string;
  allowedPaths?: string[];
  status?: 'active' | 'expired' | 'canceled';
}

export interface EffectiveEntitlement {
  effectiveTierId: MembershipTierId;
  hasSchoolSponsorship: boolean;
  schoolName?: string;
  schoolLogoUrl?: string;
  allowedPaths: Set<string>;
  canAccessPath: (pathId: string) => boolean;
  features: MembershipTierFeatures;
  badgeText: string;
  badgeStyle: string;
  remainingDays?: number;
  expirationDate?: string;
  highestIndividualTier?: MembershipTierId;
}

/**
 * Resolves effective permissions by computing the hybrid union:
 * `effective_access = school_access ∪ individual_access`
 *
 * Guarantees that:
 * 1. A school-affiliated student never loses access to their school's licensed paths.
 * 2. Individual purchases layer on top, unlocking additional paths and VIP AI capabilities.
 * 3. Expired individual purchases degrade gracefully to school or free tier.
 */
export function resolveEffectiveAccess(params: {
  schoolContract?: SchoolContractContext | null;
  individualEntitlements?: IndividualEntitlement[];
}): EffectiveEntitlement {
  const { schoolContract, individualEntitlements = [] } = params;

  const now = new Date();
  const allowedPaths = new Set<string>();

  // 1. Process School Sponsorship
  const hasSchoolSponsorship = Boolean(
    schoolContract &&
    schoolContract.schoolName &&
    (!schoolContract.validUntil || new Date(schoolContract.validUntil) >= now)
  );

  if (hasSchoolSponsorship && schoolContract) {
    for (const path of schoolContract.allowedPaths || []) {
      allowedPaths.add(path);
    }
  }

  // 2. Process Active Individual Entitlements
  const activeIndividualEntitlements = individualEntitlements.filter((e) => {
    if (e.status && e.status !== 'active') return false;
    if (e.validUntil) {
      return new Date(e.validUntil) >= now;
    }
    return true;
  });

  // Determine highest tier rank
  const tierRanks: Record<MembershipTierId, number> = {
    free_starter: 0,
    smart_foundation: 1,
    golden_excellence: 2,
    diamond_vip: 3,
  };

  let highestIndividualTier: MembershipTierId = 'free_starter';
  let nearestExpiration: string | undefined;

  for (const ent of activeIndividualEntitlements) {
    if (tierRanks[ent.tierId] > tierRanks[highestIndividualTier]) {
      highestIndividualTier = ent.tierId;
    }
    if (ent.validUntil) {
      if (!nearestExpiration || new Date(ent.validUntil) < new Date(nearestExpiration)) {
        nearestExpiration = ent.validUntil;
      }
    }
    // Add paths from individual entitlement
    if (ent.allowedPaths) {
      for (const p of ent.allowedPaths) {
        if (p === '*') {
          allowedPaths.add('qudurat_general');
          allowedPaths.add('tahsili_science');
          allowedPaths.add('tahsili_arts');
          allowedPaths.add('nafis_national');
        } else {
          allowedPaths.add(p);
        }
      }
    }
  }

  // If diamond VIP individual, grant all paths automatically
  if (highestIndividualTier === 'diamond_vip') {
    allowedPaths.add('qudurat_general');
    allowedPaths.add('tahsili_science');
    allowedPaths.add('tahsili_arts');
    allowedPaths.add('nafis_national');
  }

  // 3. Resolve Merged Features
  const baseTier = MEMBERSHIP_TIERS.find((t) => t.id === highestIndividualTier) || MEMBERSHIP_TIERS[0];
  const mergedFeatures: MembershipTierFeatures = { ...baseTier.features };

  // If school is active, unlock question bank & foundational courses if included in school modules
  if (hasSchoolSponsorship && schoolContract) {
    const modules = schoolContract.modules || ['SCHOOL_CORE', 'QUESTION_BANK', 'SCHOOL_ASSESSMENTS'];
    if (modules.includes('QUESTION_BANK')) {
      mergedFeatures.questionBankFull = true;
      mergedFeatures.maxQuestionsPerDay = Infinity;
    }
    if (modules.includes('SCHOOL_ASSESSMENTS')) {
      mergedFeatures.mockExamsUnlimited = true;
    }
    if (modules.includes('PATHS_AND_COURSES')) {
      mergedFeatures.foundationCourses = true;
    }
    if (modules.includes('INTERVENTION_CENTER') || modules.includes('SCHOOL_INTELLIGENCE')) {
      mergedFeatures.skillsGapRadar = true;
    }
  }

  // 4. Calculate Remaining Days
  let remainingDays: number | undefined;
  const targetExpDate = nearestExpiration || schoolContract?.validUntil;
  if (targetExpDate) {
    const diffMs = new Date(targetExpDate).getTime() - now.getTime();
    remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 5. Construct Badge Label & Styling
  let badgeText = 'حساب تجريبي مجاني';
  let badgeStyle = 'border-slate-200 bg-slate-50 text-slate-700';

  if (highestIndividualTier === 'diamond_vip') {
    badgeText = '💎 عضوية VIP الماسية';
    badgeStyle = 'border-amber-300 bg-amber-50 text-amber-900';
  } else if (highestIndividualTier === 'golden_excellence') {
    badgeText = '🏆 باقة التميز الذهبية';
    badgeStyle = 'border-indigo-300 bg-indigo-50 text-indigo-900';
  } else if (highestIndividualTier === 'smart_foundation') {
    badgeText = '⚡ باقة التأسيس الذكي';
    badgeStyle = 'border-blue-300 bg-blue-50 text-blue-900';
  } else if (hasSchoolSponsorship && schoolContract) {
    badgeText = `🏫 باقة مدرسة: ${schoolContract.schoolName}`;
    badgeStyle = 'border-emerald-300 bg-emerald-50 text-emerald-900';
  }

  return {
    effectiveTierId: highestIndividualTier,
    hasSchoolSponsorship,
    schoolName: schoolContract?.schoolName,
    schoolLogoUrl: schoolContract?.logoUrl,
    allowedPaths,
    canAccessPath: (pathId: string) => {
      if (allowedPaths.has('*')) return true;
      return allowedPaths.has(pathId);
    },
    features: mergedFeatures,
    badgeText,
    badgeStyle,
    remainingDays,
    expirationDate: targetExpDate,
    highestIndividualTier,
  };
}

