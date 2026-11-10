import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Filter, HelpCircle, MessageCircle, Plus, Search, Sparkles } from 'lucide-react';

interface QAItem {
  id: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  subjectName: string;
  date: string;
  likes: number;
}

export const QATab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'answered' | 'pending'>('all');
  const [showAskModal, setShowAskModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newSubject, setNewSubject] = useState('القدرات العامة');
  const [submittedMessage, setSubmittedMessage] = useState(false);

  const [qaList, setQaList] = useState<QAItem[]>([
    {
      id: 'qa-1',
      question: 'كيف أفرق بين التناظر اللفظي لعلاقة (سبب ونتيجة) وعلاقة (تدرج)؟',
      answer: 'علاقة السبب والنتيجة تعني أن الأول يؤدي حتماً للثاني مثل (فيروس : مرض). أما التدرج فيعني انتقال الشيء من مرحلة إلى أخرى عبر الزمن مثل (هلال : بدر) أو (طفل : شاب).',
      answeredBy: 'أ. أحمد المعلم - مدرب القدرات',
      subjectName: 'القدرات - لفظي',
      date: 'منذ يومين',
      likes: 14,
    },
    {
      id: 'qa-2',
      question: 'في مسائل السرعة والمسافة، متى أستخدم قانون السرعة المتوسطة 2×ع1×ع2 / (ع1+ع2)؟',
      answer: 'تستخدم هذا القانون حصراً عندما تكون المسافة في الذهاب هي نفسها مسافة الإياب (المسافة متساوية والسرعات مختلفة). أما إذا كانت المسافات مختلفة فتحسب: إجمالي المسافة ÷ إجمالي الزمن.',
      answeredBy: 'د. خالد العمري - قسم الرياضيات',
      subjectName: 'القدرات - كمي',
      date: 'منذ 3 أيام',
      likes: 29,
    },
    {
      id: 'qa-3',
      question: 'ما هي أهم الدوال الدائرية التي تتكرر في تحصيلي الرياضيات؟',
      answer: 'ركز على متطابقات فيثاغورس (sin² + cos² = 1)، ومقلوبات الدوال، وقيم الزوايا الشهيرة (30°، 45°، 60°)، ودورة وسعة دالتي الجيب وجيب التمام.',
      answeredBy: 'أ. سارة الحربي - مدربة التحصيلي',
      subjectName: 'التحصيلي - رياضيات',
      date: 'منذ أسبوع',
      likes: 18,
    },
    {
      id: 'qa-4',
      question: 'هل يمكن حل مسائل الأعمار بتجريب الخيارات دائماً؟',
      answer: 'نعم، تجريب الخيارات في مسائل الأعمار من أسرع وأضمن الاستراتيجيات، ابدأ دائماً بالخيار المتوسط، واستبعد الخيارات غير المنطقية.',
      answeredBy: 'أ. فيصل الشمري',
      subjectName: 'القدرات - كمي',
      date: 'منذ أسبوعين',
      likes: 9,
    },
  ]);

  const filtered = useMemo(() => {
    return qaList.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.question.toLowerCase().includes(search.toLowerCase()) ||
        item.subjectName.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'answered' && Boolean(item.answer)) ||
        (filter === 'pending' && !item.answer);
      return matchSearch && matchFilter;
    });
  }, [filter, qaList, search]);

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    const item: QAItem = {
      id: `qa-${Date.now()}`,
      question: newQuestion.trim(),
      subjectName: newSubject,
      date: 'الآن',
      likes: 0,
    };
    setQaList((prev) => [item, ...prev]);
    setNewQuestion('');
    setShowAskModal(false);
    setSubmittedMessage(true);
    setTimeout(() => setSubmittedMessage(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black">
            <MessageCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">سؤال وجواب</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              اطرح أسئلتك واحصل على إجابات معتمدة من معلمي ومدربي منصة المئة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAskModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
        >
          <Plus size={16} />
          اطرح سؤالاً جديداً
        </button>
      </div>

      {submittedMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 p-4 font-bold text-emerald-800 dark:text-emerald-300 animate-fade-in">
          ✅ تم إرسال سؤالك بنجاح! سيصلك تنبيه فور إجابة المعلم.
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الأسئلة الشائعة والشروحات..."
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pr-10 pl-4 py-2.5 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'answered', label: 'المجاب عنها' },
              { id: 'pending', label: 'بانتظار الرد' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                filter === tab.id
                  ? 'bg-sky-600 text-white font-black shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions Feed */}
      <div className="space-y-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition hover:border-sky-200 dark:hover:border-slate-700 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60 px-3 py-0.5 text-xs font-black">
                {item.subjectName}
              </span>
              <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">{item.date}</span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
              {item.question}
            </h3>

            {item.answer ? (
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-100 dark:border-slate-700/80">
                <div className="flex items-center gap-2 mb-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={15} />
                  <span>إجابة معتمدة · {item.answeredBy}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-200 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                <Clock size={14} />
                <span>السؤال قيد مراجعة المدرب وسيتم الرد عليه قريباً.</span>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Ask Question Modal */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800 animate-fade-in">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">طرح سؤال تعليمي جديد</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 font-bold">
              اكتب سؤالك بوضوح وحدد المادة ليجيبك المدرب المختص.
            </p>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">المسار أو المادة</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs font-bold text-gray-800 dark:text-slate-100"
                >
                  <option value="القدرات - كمي">القدرات - كمي</option>
                  <option value="القدرات - لفظي">القدرات - لفظي</option>
                  <option value="التحصيلي - رياضيات">التحصيلي - رياضيات</option>
                  <option value="التحصيلي - فيزياء">التحصيلي - فيزياء</option>
                  <option value="التحصيلي - كيمياء">التحصيلي - كيمياء</option>
                  <option value="التحصيلي - أحياء">التحصيلي - أحياء</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">نص السؤال</label>
                <textarea
                  rows={4}
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="اكتب سؤالك واستفسارك بالتفصيل..."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-bold text-white transition shadow-xs"
                >
                  نشر السؤال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
