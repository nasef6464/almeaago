import React, { useRef, useState } from 'react';
import { Award, CheckCircle2, MessageCircle, Printer, Trophy, X, Zap, Sparkles } from 'lucide-react';

export type CertificateKind = 'excellence' | 'smart_classroom_hero' | 'persistence';

interface TeacherCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSchoolName?: string;
  defaultTeacherName?: string;
  defaultClassName?: string;
  suggestedStudents?: Array<{ id: string; name: string }>;
}

const KIND_DETAILS: Record<CertificateKind, { title: string; subtitle: string; badge: string; accentColor: string }> = {
  excellence: {
    title: 'شهادة تفوق وتميز أكاديمي',
    subtitle: 'تقديراً للأداء الاستثنائي والدرجات العالية في مسار القدرات العامة والتحصيلي ومشاركاته الصفية المتميزة.',
    badge: '🏆 وسام التفوق والتميز',
    accentColor: 'from-amber-600 via-amber-500 to-yellow-400',
  },
  smart_classroom_hero: {
    title: 'شهادة بطل الحصة الذكية والتحديات',
    subtitle: 'تقديراً للسرعة والذكاء ودقة الإجابة وتصدر لوحة الشرف في مسابقات الحصة الذكية وأسئلة التحدي المباشرة.',
    badge: '⚡ بطل التحديات السريعة',
    accentColor: 'from-purple-600 via-indigo-600 to-amber-500',
  },
  persistence: {
    title: 'شهادة تطور ومثابرة دراسية',
    subtitle: 'تقديراً للالتزام اليومي والتحسن الملحوظ والشغف المستمر في إتقان المهارات وتجاوز الفجوات المعرفية.',
    badge: '🌟 وسام المثابرة والتقدم',
    accentColor: 'from-emerald-600 via-teal-600 to-emerald-400',
  },
};

export const TeacherCertificateModal: React.FC<TeacherCertificateModalProps> = ({
  isOpen,
  onClose,
  defaultSchoolName = 'مدارس المئة النموذجية الأهلية',
  defaultTeacherName = 'أ. فهد القحطاني - معلم القدرات',
  defaultClassName = 'الصف الثالث الثانوي (أ)',
  suggestedStudents = [
    { id: '1', name: 'فيصل بن سعد' },
    { id: '2', name: 'سارة خالد المنصور' },
    { id: '3', name: 'محمد الدوسري' },
    { id: '4', name: 'ريان الغامدي' },
  ],
}) => {
  const [studentName, setStudentName] = useState(suggestedStudents[0]?.name || 'فيصل بن سعد');
  const [schoolName, setSchoolName] = useState(defaultSchoolName);
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [className, setClassName] = useState(defaultClassName);
  const [kind, setKind] = useState<CertificateKind>('smart_classroom_hero');
  const [dateStr] = useState(() => new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }));
  const [certCode] = useState(() => `CERT-${Math.random().toString(36).slice(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`);

  if (!isOpen) return null;

  const currentKind = KIND_DETAILS[kind];

  const handlePrint = () => {
    window.print();
  };

  const whatsappMessage = encodeURIComponent(
    `السلام عليكم ورحمة الله وبركاته 💐\nيسر إدارة ${schoolName} بالتعاون مع منصة المئة أن تهنئكم بتفوق ابنكم البطل (${studentName}) في ${className} وحصوله على:\n"${currentKind.badge}" 🏅\nنبارك لكم هذا التميز ونتمنى له دوام التوفيق والدرجات العليا!`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-certificate, #printable-certificate * { visibility: visible !important; }
          #printable-certificate { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; padding: 20px !important; box-shadow: none !important; border: 0 !important; z-index: 99999 !important; background: white !important; }
        }
      `}</style>

      <div className="relative my-auto w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Trophy size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900">منشئ شهادات التقدير والتحفيز</h2>
              <p className="text-xs text-slate-500">إصدار وتخصيص شهادة تفوق فورية للطباعة أو الإرسال لولي الأمر</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Configuration Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-5 bg-slate-50/70 border-b border-slate-100 text-xs font-bold">
          <div>
            <label className="block text-slate-600 mb-1">اسم الطالب المكرم</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              placeholder="اكتب اسم الطالب..."
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">الفصل الدراسي</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">المدرسة</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">نوع التكريم / الوسام</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CertificateKind)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="smart_classroom_hero">⚡ بطل الحصة والتحديات</option>
              <option value="excellence">🏆 وسام التفوق والتميز</option>
              <option value="persistence">🌟 وسام المثابرة والتقدم</option>
            </select>
          </div>
        </div>

        {/* Printable Royal Arabic Certificate Canvas */}
        <div className="p-6 overflow-x-auto flex justify-center bg-slate-100/70">
          <div
            id="printable-certificate"
            className="w-full max-w-2xl bg-white rounded-3xl p-8 border-8 border-double border-amber-300/80 shadow-xl relative text-center text-slate-800 font-sans"
            style={{
              backgroundImage: 'radial-gradient(circle at center, #ffffff 0%, #faf8f5 100%)',
            }}
          >
            {/* Ornamental Corners */}
            <div className="absolute top-3 right-3 text-amber-500/40 text-xl font-serif">❖</div>
            <div className="absolute top-3 left-3 text-amber-500/40 text-xl font-serif">❖</div>
            <div className="absolute bottom-3 right-3 text-amber-500/40 text-xl font-serif">❖</div>
            <div className="absolute bottom-3 left-3 text-amber-500/40 text-xl font-serif">❖</div>

            {/* School & Platform Logos Header */}
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-4 mb-5">
              <div className="text-right">
                <p className="text-xs font-black text-amber-800">{schoolName}</p>
                <p className="text-[10px] text-slate-500">إشراف قسم التوجيه والتفوق الدراسي</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-800 text-xs font-black">
                <Sparkles size={14} className="text-amber-500" /> منصة المئة التعليمية
              </div>
            </div>

            {/* Certificate Header Banner */}
            <div className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-white font-black text-base shadow-sm mb-4">
              {currentKind.title}
            </div>

            <p className="text-xs text-slate-500 font-bold mb-4">
              بكل فخر واعتزاز، تمنح إدارة المدرسة ومنصة المئة هذه الشهادة للابن البطل:
            </p>

            {/* Student Name */}
            <div className="my-3 py-2 px-6 inline-block border-b-2 border-dashed border-amber-400">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wide">
                {studentName}
              </h1>
            </div>

            <p className="text-xs text-indigo-700 font-black mt-1">
              المقيد في: {className}
            </p>

            <p className="mt-4 text-xs text-slate-600 max-w-lg mx-auto leading-6 font-medium">
              {currentKind.subtitle}
            </p>

            {/* Golden Badge Emblem */}
            <div className="my-5 flex justify-center">
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-2 text-amber-900 font-black text-xs shadow-xs">
                <Award size={18} className="text-amber-600" />
                <span>{currentKind.badge}</span>
              </div>
            </div>

            {/* Signatures & Serial Code */}
            <div className="mt-8 pt-4 border-t border-amber-200/60 flex items-end justify-between text-xs text-slate-600 font-bold">
              <div className="text-right">
                <p className="text-slate-400 text-[10px]">معلم المادة</p>
                <p className="font-black text-slate-800 mt-1">{teacherName}</p>
                <p className="text-[10px] text-emerald-600 font-black">توقيع معتمد ✓</p>
              </div>

              <div className="text-center">
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[10px] text-slate-500 font-mono" dir="ltr">
                  {certCode}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{dateStr}</p>
              </div>

              <div className="text-left">
                <p className="text-slate-400 text-[10px]">ختم الإدارة المدرسية</p>
                <p className="font-black text-slate-800 mt-1">مدير المدرسة</p>
                <p className="text-[10px] text-indigo-600 font-black">معتمد رسمياً</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-t border-slate-100 bg-white rounded-b-3xl">
          <div className="text-xs text-slate-500 font-medium">
            جاهزة للتنزيل والطباعة عالية الدقة وإرسالها لولي أمر الطالب
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              إغلاق
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm transition-all"
            >
              <MessageCircle size={15} /> إرسال لولي الأمر عبر واتساب
            </a>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-black text-white shadow-sm active:scale-95 transition-all"
            >
              <Printer size={15} /> طباعة الشهادة الرسمية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
