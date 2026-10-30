import React from 'react';
import {
  Calculator,
  Percent,
  Binary,
  Divide,
  Compass,
  TrendingUp,
  BarChart3,
  Hash,
  PieChart,
  Scale,
  Shapes,
  Grid,
  BookOpen,
  Feather,
  PenTool,
  MessageSquare,
  Languages,
  BookMarked,
  Quote,
  FileText,
  SpellCheck,
  Library,
  ScrollText,
  Newspaper,
  Atom,
  Zap,
  Orbit,
  Magnet,
  Gauge,
  BatteryCharging,
  FlaskConical,
  FlaskRound,
  TestTube,
  TestTubes,
  Flame,
  Droplets,
  Sparkles,
  Dna,
  Microscope,
  HeartPulse,
  Leaf,
  Trees,
  Bug,
  Activity,
  Globe,
  BookA,
  Headphones,
  Volume2,
  Ear,
  MessageCircle,
  Mic,
  GraduationCap,
  School,
  Building,
  Award,
  Medal,
  Target,
  Trophy,
  Rocket,
  Brain,
  ShieldCheck,
  Timer,
  CheckCircle2,
  Puzzle,
  Backpack,
  Lightbulb,
  HelpCircle,
  Layers,
  LucideIcon
} from 'lucide-react';

export type EducationalIconCategory =
  | 'all'
  | 'math'
  | 'verbal'
  | 'science'
  | 'languages'
  | 'stages'
  | 'skills';

export interface EducationalIconItem {
  id: string; // The value stored in path.icon, subject.icon, or level.icon
  label: string;
  category: EducationalIconCategory;
  type: 'lucide' | 'emoji';
  lucideName?: string;
  emoji?: string;
  keywords: string[];
}

export const LUCIDE_ICONS_MAP: Record<string, LucideIcon> = {
  // Math & Quantitative
  Calculator,
  Percent,
  Binary,
  Divide,
  Compass,
  TrendingUp,
  BarChart3,
  Hash,
  PieChart,
  Scale,
  Shapes,
  Grid,

  // Verbal & Arabic
  BookOpen,
  Feather,
  PenTool,
  MessageSquare,
  Languages,
  BookMarked,
  Quote,
  FileText,
  SpellCheck,
  Library,
  ScrollText,
  Newspaper,

  // Natural Sciences
  Atom,
  Zap,
  Orbit,
  Magnet,
  Gauge,
  BatteryCharging,
  FlaskConical,
  FlaskRound,
  TestTube,
  TestTubes,
  Flame,
  Droplets,
  Sparkles,
  Dna,
  Microscope,
  HeartPulse,
  Leaf,
  Trees,
  Bug,
  Activity,

  // Languages & English
  Globe,
  BookA,
  Headphones,
  Volume2,
  Ear,
  MessageCircle,
  Mic,

  // Stages & Grades
  GraduationCap,
  School,
  Building,
  Award,
  Medal,
  Backpack,

  // Skills & Excellence
  Target,
  Trophy,
  Rocket,
  Brain,
  ShieldCheck,
  Timer,
  CheckCircle2,
  Puzzle,
  Lightbulb,
  Layers,
  HelpCircle,
};

export const ICON_CATEGORIES: { id: EducationalIconCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'الكل', icon: '🌟' },
  { id: 'math', label: 'الكمي والرياضيات', icon: '🧮' },
  { id: 'verbal', label: 'اللفظي والعربية', icon: '📖' },
  { id: 'science', label: 'العلوم الطبيعية', icon: '🔬' },
  { id: 'languages', label: 'اللغات والإنجليزية', icon: '🌍' },
  { id: 'stages', label: 'المراحل والصفوف', icon: '🎓' },
  { id: 'skills', label: 'التميز والمهارات', icon: '🎯' },
];

export const EDUCATIONAL_ICONS: EducationalIconItem[] = [
  // ----------------------------------------------------
  // 1. Math & Quantitative (الكمي والرياضيات)
  // ----------------------------------------------------
  { id: '🧮', label: 'معداد', category: 'math', type: 'emoji', emoji: '🧮', keywords: ['كمي', 'حساب', 'رياضيات', 'معداد', 'abacus', 'math'] },
  { id: 'lucide:Calculator', label: 'آلة حاسبة', category: 'math', type: 'lucide', lucideName: 'Calculator', keywords: ['حاسبة', 'كمي', 'رياضيات', 'ارقام', 'calculator', 'math'] },
  { id: '📐', label: 'مثلث هندسي', category: 'math', type: 'emoji', emoji: '📐', keywords: ['هندسة', 'مثلث', 'زوايا', 'geometry', 'triangle'] },
  { id: 'lucide:Percent', label: 'نسبة مئوية', category: 'math', type: 'lucide', lucideName: 'Percent', keywords: ['نسبة', 'مئوية', 'كسور', 'تخفيض', 'percent', 'math'] },
  { id: '📊', label: 'رسم بياني', category: 'math', type: 'emoji', emoji: '📊', keywords: ['إحصاء', 'رسم بياني', 'مقارنات', 'chart', 'stats'] },
  { id: 'lucide:TrendingUp', label: 'مؤشر صاعد', category: 'math', type: 'lucide', lucideName: 'TrendingUp', keywords: ['تطور', 'نمو', 'صعود', 'trend', 'growth'] },
  { id: 'lucide:Compass', label: 'فرجار هندسي', category: 'math', type: 'lucide', lucideName: 'Compass', keywords: ['فرجار', 'هندسة', 'دوائر', 'compass'] },
  { id: '📈', label: 'مخطط بياني', category: 'math', type: 'emoji', emoji: '📈', keywords: ['مخطط', 'بيانات', 'إحصاء', 'graph'] },
  { id: 'lucide:Shapes', label: 'أشكال هندسية', category: 'math', type: 'lucide', lucideName: 'Shapes', keywords: ['أشكال', 'مربع', 'دائرة', 'هندسة', 'shapes'] },
  { id: 'lucide:Binary', label: 'ثنائي / منطق', category: 'math', type: 'lucide', lucideName: 'Binary', keywords: ['ارقام', 'منطق', 'برمجة', 'binary'] },
  { id: 'lucide:Divide', label: 'قسمة وعمليات', category: 'math', type: 'lucide', lucideName: 'Divide', keywords: ['قسمة', 'كسور', 'عمليات', 'divide', 'math'] },
  { id: 'lucide:Hash', label: 'رمز الأرقام', category: 'math', type: 'lucide', lucideName: 'Hash', keywords: ['رقم', 'اعداد', 'hash', 'number'] },
  { id: 'lucide:Scale', label: 'ميزان ومعادلات', category: 'math', type: 'lucide', lucideName: 'Scale', keywords: ['ميزان', 'معادلة', 'تساوي', 'مقارنة', 'scale'] },
  { id: '🔢', label: 'أرقام وحساب', category: 'math', type: 'emoji', emoji: '🔢', keywords: ['ارقام', 'حساب', 'اعداد', '1234'] },
  { id: '🎲', label: 'احتمالات ونرد', category: 'math', type: 'emoji', emoji: '🎲', keywords: ['احتمالات', 'نرد', 'عشوائي', 'dice'] },
  { id: '📏', label: 'مسطرة وقياس', category: 'math', type: 'emoji', emoji: '📏', keywords: ['مسطرة', 'قياس', 'ابعاد', 'ruler'] },

  // ----------------------------------------------------
  // 2. Verbal & Arabic (اللفظي واللغة العربية)
  // ----------------------------------------------------
  { id: '📖', label: 'كتاب مفتوح', category: 'verbal', type: 'emoji', emoji: '📖', keywords: ['قراءة', 'كتاب', 'استيعاب', 'لفظي', 'عربي', 'book'] },
  { id: 'lucide:BookOpen', label: 'استيعاب المقروء', category: 'verbal', type: 'lucide', lucideName: 'BookOpen', keywords: ['قراءة', 'استيعاب', 'لفظي', 'كتاب', 'book'] },
  { id: '✍️', label: 'كتابة وتعبير', category: 'verbal', type: 'emoji', emoji: '✍️', keywords: ['كتابة', 'تعبير', 'قلم', 'املاء', 'writing'] },
  { id: 'lucide:Feather', label: 'ريشة أدبية', category: 'verbal', type: 'lucide', lucideName: 'Feather', keywords: ['بلاغة', 'ادب', 'شعر', 'ريشة', 'feather'] },
  { id: 'lucide:PenTool', label: 'قلم التحرير', category: 'verbal', type: 'lucide', lucideName: 'PenTool', keywords: ['تحرير', 'نحو', 'قلم', 'pen'] },
  { id: '📚', label: 'مكتبة كتب', category: 'verbal', type: 'emoji', emoji: '📚', keywords: ['كتب', 'مكتبة', 'دراسة', 'books'] },
  { id: 'lucide:Languages', label: 'اللغة والبيان', category: 'verbal', type: 'lucide', lucideName: 'Languages', keywords: ['لغة', 'مفردات', 'ترجمة', 'بيان', 'languages'] },
  { id: 'lucide:Quote', label: 'اقتباس وبلاغة', category: 'verbal', type: 'lucide', lucideName: 'Quote', keywords: ['اقتباس', 'بلاغة', 'حكمة', 'شواهد', 'quote'] },
  { id: 'lucide:BookMarked', label: 'فهرس ومراجع', category: 'verbal', type: 'lucide', lucideName: 'BookMarked', keywords: ['مرجع', 'علامة', 'كتاب', 'bookmark'] },
  { id: 'lucide:SpellCheck', label: 'التدقيق الإملائي', category: 'verbal', type: 'lucide', lucideName: 'SpellCheck', keywords: ['املاء', 'نحو', 'تصحيح', 'تدقيق', 'spell'] },
  { id: '📝', label: 'مذكرة وإكمال جمل', category: 'verbal', type: 'emoji', emoji: '📝', keywords: ['مذكرة', 'اكمال', 'جمل', 'تدوين', 'memo'] },
  { id: 'lucide:ScrollText', label: 'نصوص ومخطوطات', category: 'verbal', type: 'lucide', lucideName: 'ScrollText', keywords: ['مخطوطة', 'نص', 'تاريخ', 'وثيقة', 'scroll'] },
  { id: '🗣️', label: 'تحدث وتناظر', category: 'verbal', type: 'emoji', emoji: '🗣️', keywords: ['تناظر', 'لفظي', 'كلام', 'حوار', 'speak'] },
  { id: '📜', label: 'وثيقة وبلاغة', category: 'verbal', type: 'emoji', emoji: '📜', keywords: ['وثيقة', 'شعر', 'بلاغة', 'scroll'] },

  // ----------------------------------------------------
  // 3. Natural Sciences (العلوم الطبيعية: فيزياء، كيمياء، أحياء)
  // ----------------------------------------------------
  { id: 'lucide:Atom', label: 'الذرة والفيزياء', category: 'science', type: 'lucide', lucideName: 'Atom', keywords: ['فيزياء', 'ذرة', 'طاقة', 'علوم', 'atom', 'physics'] },
  { id: '🔬', label: 'مجهر مخبري', category: 'science', type: 'emoji', emoji: '🔬', keywords: ['مجهر', 'احياء', 'علوم', 'مختبر', 'microscope'] },
  { id: 'lucide:Microscope', label: 'الفحص المجهري', category: 'science', type: 'lucide', lucideName: 'Microscope', keywords: ['مجهر', 'فحص', 'خلايا', 'احياء', 'microscope'] },
  { id: '🧪', label: 'أنبوب كيمياء', category: 'science', type: 'emoji', emoji: '🧪', keywords: ['كيمياء', 'محلول', 'تفاعل', 'مختبر', 'testtube', 'chemistry'] },
  { id: 'lucide:FlaskConical', label: 'دورق كيميائي', category: 'science', type: 'lucide', lucideName: 'FlaskConical', keywords: ['دورق', 'كيمياء', 'تفاعلات', 'مركبات', 'flask'] },
  { id: '🧬', label: 'الحمض النووي DNA', category: 'science', type: 'emoji', emoji: '🧬', keywords: ['وراثة', 'dna', 'جينات', 'احياء', 'خلية'] },
  { id: 'lucide:Dna', label: 'علم الوراثة والجينات', category: 'science', type: 'lucide', lucideName: 'Dna', keywords: ['وراثة', 'جينات', 'احياء', 'خلية', 'dna'] },
  { id: '⚡', label: 'الكهرباء والطاقة', category: 'science', type: 'emoji', emoji: '⚡', keywords: ['كهرباء', 'طاقة', 'جهد', 'فيزياء', 'electricity'] },
  { id: 'lucide:Zap', label: 'طاقة وموجات', category: 'science', type: 'lucide', lucideName: 'Zap', keywords: ['طاقة', 'كهرباء', 'برق', 'قدرة', 'zap'] },
  { id: 'lucide:Magnet', label: 'مغناطيسية وحث', category: 'science', type: 'lucide', lucideName: 'Magnet', keywords: ['مغناطيس', 'حث', 'مجال', 'فيزياء', 'magnet'] },
  { id: 'lucide:Orbit', label: 'مدارات وفلك', category: 'science', type: 'lucide', lucideName: 'Orbit', keywords: ['فلك', 'مدار', 'جاذبية', 'كواكب', 'orbit'] },
  { id: '🧲', label: 'مغناطيس فيزيائي', category: 'science', type: 'emoji', emoji: '🧲', keywords: ['مغناطيس', 'فيزياء', 'شحنات', 'magnet'] },
  { id: 'lucide:FlaskRound', label: 'تفاعلات عضوية', category: 'science', type: 'lucide', lucideName: 'FlaskRound', keywords: ['كيمياء', 'عضوية', 'تفاعل', 'دورق', 'flask'] },
  { id: 'lucide:Leaf', label: 'علم النبات والبيئة', category: 'science', type: 'lucide', lucideName: 'Leaf', keywords: ['نبات', 'بيئة', 'احياء', 'تمثيل ضوئي', 'leaf', 'biology'] },
  { id: 'lucide:HeartPulse', label: 'أجهزة جسم الإنسان', category: 'science', type: 'lucide', lucideName: 'HeartPulse', keywords: ['قلب', 'نبض', 'احياء', 'انسان', 'طبي', 'health'] },
  { id: 'lucide:Flame', label: 'حرارة وطاقة حرارية', category: 'science', type: 'lucide', lucideName: 'Flame', keywords: ['حرارة', 'طاقة', 'احتراق', 'ثيرمو', 'flame'] },
  { id: '🌿', label: 'نباتات وبيئة', category: 'science', type: 'emoji', emoji: '🌿', keywords: ['نبات', 'بيئة', 'احياء', 'green'] },
  { id: '🪐', label: 'كواكب وفيزياء فلكية', category: 'science', type: 'emoji', emoji: '🪐', keywords: ['فضاء', 'فلك', 'كواكب', 'planet'] },

  // ----------------------------------------------------
  // 4. Languages & English (اللغات والإنجليزية)
  // ----------------------------------------------------
  { id: '🌍', label: 'العالم واللغات', category: 'languages', type: 'emoji', emoji: '🌍', keywords: ['لغات', 'عالم', 'انجليزي', 'world', 'globe'] },
  { id: 'lucide:Globe', label: 'العالمية واللغات', category: 'languages', type: 'lucide', lucideName: 'Globe', keywords: ['كرة ارضية', 'لغات', 'عالمي', 'globe'] },
  { id: 'lucide:BookA', label: 'المفردات والقواعد (A-Z)', category: 'languages', type: 'lucide', lucideName: 'BookA', keywords: ['انجليزي', 'حروف', 'مفردات', 'قواعد', 'english', 'booka'] },
  { id: 'lucide:Headphones', label: 'مهارة الاستماع Listening', category: 'languages', type: 'lucide', lucideName: 'Headphones', keywords: ['استماع', 'صوتيات', 'سماعات', 'listening', 'step'] },
  { id: 'lucide:MessageCircle', label: 'المحادثة والطلاقة Conversation', category: 'languages', type: 'lucide', lucideName: 'MessageCircle', keywords: ['محادثة', 'حوار', 'طلاقة', 'conversation'] },
  { id: '🅰️', label: 'الأبجدية الإنجليزية', category: 'languages', type: 'emoji', emoji: '🅰️', keywords: ['حرف', 'ابجدية', 'انجليزي', 'a'] },
  { id: '🎧', label: 'سماعات واستماع', category: 'languages', type: 'emoji', emoji: '🎧', keywords: ['استماع', 'صوتيات', 'انجليزي', 'headphones'] },
  { id: '💬', label: 'محادثة وتواصل', category: 'languages', type: 'emoji', emoji: '💬', keywords: ['تواصل', 'محادثة', 'حوار', 'chat'] },

  // ----------------------------------------------------
  // 5. Stages & Grades (المراحل والصفوف الدراسية)
  // ----------------------------------------------------
  { id: '🎓', label: 'قبعة التخرج', category: 'stages', type: 'emoji', emoji: '🎓', keywords: ['تخرج', 'جامعة', 'ثانوي', 'مرحلة', 'شهادة', 'grad'] },
  { id: 'lucide:GraduationCap', label: 'المرحلة والتخرج', category: 'stages', type: 'lucide', lucideName: 'GraduationCap', keywords: ['مرحلة', 'تخرج', 'شهادة', 'ثانوي', 'grad'] },
  { id: '🏫', label: 'مدرسة تعليمية', category: 'stages', type: 'emoji', emoji: '🏫', keywords: ['مدرسة', 'تعليم', 'صفوف', 'school'] },
  { id: 'lucide:School', label: 'الصرح المدرسي', category: 'stages', type: 'lucide', lucideName: 'School', keywords: ['مدرسة', 'صرح', 'متوسط', 'ابتدائي', 'school'] },
  { id: '🎒', label: 'حقيبة مدرسية (ابتدائي)', category: 'stages', type: 'emoji', emoji: '🎒', keywords: ['ابتدائي', 'حقيبة', 'مدرسة', 'شنطة', 'backpack'] },
  { id: 'lucide:Backpack', label: 'حقيبة المرحلة الأساسية', category: 'stages', type: 'lucide', lucideName: 'Backpack', keywords: ['ابتدائي', 'تأسيس', 'حقيبة', 'backpack'] },
  { id: 'lucide:Building', label: 'المجمع التعليمي', category: 'stages', type: 'lucide', lucideName: 'Building', keywords: ['مجمع', 'مبنى', 'تعليم', 'building'] },
  { id: '🏢', label: 'أكاديمية وصفوف', category: 'stages', type: 'emoji', emoji: '🏢', keywords: ['اكاديمية', 'معهد', 'صفوف'] },
  { id: '🧑‍🎓', label: 'طالب متفوق', category: 'stages', type: 'emoji', emoji: '🧑‍🎓', keywords: ['طالب', 'تلميذ', 'متعلم', 'student'] },

  // ----------------------------------------------------
  // 6. Skills & Excellence (التميز والمهارات والاختبارات)
  // ----------------------------------------------------
  { id: '🎯', label: 'الهدف والدقة', category: 'skills', type: 'emoji', emoji: '🎯', keywords: ['هدف', 'دقة', 'تدريب', 'تركيز', 'target'] },
  { id: 'lucide:Target', label: 'إصابة الهدف والتركيز', category: 'skills', type: 'lucide', lucideName: 'Target', keywords: ['هدف', 'دقة', 'تركيز', 'target'] },
  { id: '🏆', label: 'كأس البطولة والتفوق', category: 'skills', type: 'emoji', emoji: '🏆', keywords: ['كاس', 'فوز', 'اول', 'تفوق', 'trophy'] },
  { id: 'lucide:Trophy', label: 'كأس الإنجاز', category: 'skills', type: 'lucide', lucideName: 'Trophy', keywords: ['كاس', 'انجاز', 'موهبة', 'trophy'] },
  { id: 'lucide:Brain', label: 'الذكاء والقدرات العقلية', category: 'skills', type: 'lucide', lucideName: 'Brain', keywords: ['عقل', 'ذكاء', 'تفكير', 'قدرات', 'brain'] },
  { id: '🧠', label: 'تفكير ذكي وقدرات', category: 'skills', type: 'emoji', emoji: '🧠', keywords: ['تفكير', 'ذكاء', 'دماغ', 'قدرات', 'brain'] },
  { id: '⭐', label: 'نجمة التميز', category: 'skills', type: 'emoji', emoji: '⭐', keywords: ['نجمة', 'تميز', 'تفوق', 'star'] },
  { id: 'lucide:Sparkles', label: 'إبداع وتألق', category: 'skills', type: 'lucide', lucideName: 'Sparkles', keywords: ['بريق', 'ابداع', 'تالق', 'موهبة', 'sparkles'] },
  { id: '🚀', label: 'انطلاقة سريعة', category: 'skills', type: 'emoji', emoji: '🚀', keywords: ['صاروخ', 'انطلاق', 'تسريع', 'rocket'] },
  { id: 'lucide:Rocket', label: 'انطلاقة نحو القمة', category: 'skills', type: 'lucide', lucideName: 'Rocket', keywords: ['صاروخ', 'انطلاق', 'قمة', 'rocket'] },
  { id: 'lucide:Award', label: 'وسام التكريم', category: 'skills', type: 'lucide', lucideName: 'Award', keywords: ['وسام', 'جائزة', 'تكريم', 'award'] },
  { id: '🥇', label: 'المركز الأول والميدالية الذهبية', category: 'skills', type: 'emoji', emoji: '🥇', keywords: ['ميدالية', 'اول', 'ذهب', 'gold'] },
  { id: 'lucide:Medal', label: 'ميدالية الشرف', category: 'skills', type: 'lucide', lucideName: 'Medal', keywords: ['ميدالية', 'شرف', 'فوز', 'medal'] },
  { id: 'lucide:Timer', label: 'إدارة الوقت والسرعة', category: 'skills', type: 'lucide', lucideName: 'Timer', keywords: ['وقت', 'مؤقت', 'سرعة', 'زمن', 'timer'] },
  { id: '⏱️', label: 'ساعة إيقاف للاختبار', category: 'skills', type: 'emoji', emoji: '⏱️', keywords: ['ساعة', 'مؤقت', 'اختبار', 'stopwatch'] },
  { id: 'lucide:Puzzle', label: 'حل المشكلات والألغاز', category: 'skills', type: 'lucide', lucideName: 'Puzzle', keywords: ['لغز', 'مهارة', 'تركيب', 'puzzle'] },
  { id: '🧩', label: 'قطع التحدي والمهارة', category: 'skills', type: 'emoji', emoji: '🧩', keywords: ['لغز', 'تركيب', 'تحدي', 'puzzle'] },
  { id: '💡', label: 'فكرة وحلول ذكية', category: 'skills', type: 'emoji', emoji: '💡', keywords: ['فكرة', 'ابتكار', 'حلول', 'موهبة', 'idea'] },
  { id: 'lucide:Lightbulb', label: 'إلهام وفكرة مبتكرة', category: 'skills', type: 'lucide', lucideName: 'Lightbulb', keywords: ['فكرة', 'ابتكار', 'الهام', 'lightbulb'] },
  { id: 'lucide:ShieldCheck', label: 'إتقان وضمان الجودة', category: 'skills', type: 'lucide', lucideName: 'ShieldCheck', keywords: ['درع', 'امان', 'اتقان', 'ضمان', 'shield'] },
];

/**
 * Helper to resolve and render an icon string or item cleanly.
 */
export const resolveIconComponent = (
  iconStr?: string,
  className = 'w-6 h-6',
  fallbackEmoji = '📚'
): React.ReactNode => {
  if (!iconStr) {
    return React.createElement(
      'span',
      { className: className.includes('text-') ? className : 'text-xl' },
      fallbackEmoji
    );
  }

  // If prefixed with 'lucide:' or is directly a known Lucide component name
  const cleanName = iconStr.startsWith('lucide:') ? iconStr.replace('lucide:', '') : iconStr;
  const Component = LUCIDE_ICONS_MAP[cleanName];

  if (Component) {
    return React.createElement(Component, { className });
  }

  // Otherwise it's an emoji or plain character
  return React.createElement(
    'span',
    { className: className.includes('text-') ? className : 'text-xl leading-none' },
    iconStr
  );
};
