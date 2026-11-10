import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Layers,
  ArrowRight,
  BookOpen,
  Share2,
} from 'lucide-react';
import { aiClient, type GeneratedQuestion } from '../../ai/api/ai-client';
import { useAuth } from '../../auth/state/AuthProvider';
import { normalizeQuestionHtml } from '../../../lib/questionHtml';

interface AiExamGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  onCreated?: (questions: GeneratedQuestion[]) => void;
}

export const AiExamGeneratorModal: React.FC<AiExamGeneratorModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  onCreated,
}) => {
  const { getCsrfToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const [examTitle, setExamTitle] = useState('اختبار قياس الذكي - تجريبي');
  const [targetPath, setTargetPath] = useState<'qudrat' | 'tahsili' | 'nafis'>('qudrat');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [extractedQuestions, setExtractedQuestions] = useState<GeneratedQuestion[]>([]);
  const [previewMode, setPreviewMode] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    setError('');
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم الملف يتجاوز الحد الأقصى المسموح (10 ميجابايت).');
      return;
    }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('نوع الملف غير مدعوم. يرجى رفع ملف PDF أو صورة (JPEG, PNG, WebP).');
      return;
    }
    setSelectedFile(file);
  };

  const startExtraction = async () => {
    if (activeTab === 'upload' && !selectedFile) {
      setError('يرجى اختيار ملف PDF أو صورة أولاً.');
      return;
    }
    if (activeTab === 'text' && !promptText.trim()) {
      setError('يرجى كتابة أو لصق نص الأسئلة أولاً.');
      return;
    }

    setError('');
    setIsProcessing(true);
    setProgressStep(1);

    const stepTimer1 = setTimeout(() => setProgressStep(2), 2200);
    const stepTimer2 = setTimeout(() => setProgressStep(3), 5500);

    try {
      const csrf = await getCsrfToken();
      const res = await aiClient.generateAssessment(
        {
          file: activeTab === 'upload' && selectedFile ? selectedFile : undefined,
          promptText:
            activeTab === 'text'
              ? promptText
              : `استخرج الأسئلة من هذا الملف لاختبار ${
                  targetPath === 'qudrat'
                    ? 'القدرات العامة'
                    : targetPath === 'tahsili'
                    ? 'التحصيلي'
                    : 'نافس'
                }.`,
          schoolId,
        },
        csrf,
      );

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.questions || res.questions.length === 0) {
        throw new Error('لم يتمكن الذكاء الاصطناعي من استخراج أي أسئلة من هذا الملف.');
      }

      setExtractedQuestions(res.questions);
      setNotice(`تم استخراج ${res.questions.length} سؤال بنجاح مع صيغ KaTeX الرياضية!`);
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setError(err instanceof Error ? err.message : 'تعذر استخراج الأسئلة.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateQuestion = (index: number, field: keyof GeneratedQuestion, value: any) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = text;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const addQuestion = () => {
    setExtractedQuestions((prev) => [
      ...prev,
      {
        text: 'نص السؤال الجديد مع معادلات $x + y = 10$',
        options: ['أ', 'ب', 'ج', 'د'],
        correctAnswer: 0,
        explanation: 'خطوات الحل والشرح النموذجي',
        difficulty: 'medium',
        skills: ['الجبر'],
      },
    ]);
  };

  const deleteQuestion = (index: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = () => {
    if (extractedQuestions.length === 0) {
      setError('لا توجد أسئلة للاعتماد.');
      return;
    }
    if (onCreated) {
      onCreated(extractedQuestions);
    }
    setNotice('تم اعتماد الأسئلة وحفظها بنجاح في مركز الاختبارات!');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-indigo-100 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-5 text-white dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-black text-indigo-200">
                  VClasses AI Parity
                </span>
                <span className="text-xs font-bold text-slate-400">Gemini 2.5 Multimodal</span>
              </div>
              <h2 className="mt-1 text-xl font-black text-white">
                توليد الاختبارات الذكية من ملفات PDF والصور
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>{notice}</span>
            </div>
          )}

          {/* Stepper / Tabs */}
          {extractedQuestions.length === 0 ? (
            <div className="space-y-6">
              {/* Configuration Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                    عنوان الاختبار المستهدف
                  </label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold focus:border-indigo-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                    مسار القياس الوطني
                  </label>
                  <div className="flex gap-2">
                    {(
                      [
                        ['qudrat', 'القدرات العامة'],
                        ['tahsili', 'التحصيلي'],
                        ['nafis', 'نافس الوطني'],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTargetPath(val)}
                        className={`flex-1 rounded-2xl border p-2.5 text-xs font-black transition-all ${
                          targetPath === val
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input Mode Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 border-b-2 px-6 py-3 text-xs font-black transition-colors ${
                    activeTab === 'upload'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload size={16} />
                  رفع ورقة أسئلة (PDF / صورة)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center gap-2 border-b-2 px-6 py-3 text-xs font-black transition-colors ${
                    activeTab === 'text'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText size={16} />
                  لصق نص الأسئلة يدوياً
                </button>
              </div>

              {/* Upload Dropzone */}
              {activeTab === 'upload' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-12 text-center cursor-pointer transition-colors hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-500"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                  />
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-4">
                    <Upload size={32} />
                  </div>
                  {selectedFile ? (
                    <div className="space-y-1">
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} ميجابايت · جاهز للاستخراج
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                        اسحب وأفلت ورقة الأسئلة هنا، أو اضغط للاختيار من جهازك
                      </div>
                      <p className="mt-1.5 text-xs font-bold text-slate-500">
                        يدعم ملفات PDF وصور المسائل حتى 10 ميجابايت (القدرات والتحصيلي)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={8}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="الصق نص الأسئلة أو المسائل هنا. سيتولى الذكاء الاصطناعي تقسيمها وتحديد الإجابات وتنسيق الرموز الرياضية..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold leading-6 focus:border-indigo-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              {/* Progress Animation during extraction */}
              {isProcessing && (
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-6 space-y-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <Loader2 size={22} className="animate-spin text-indigo-600" />
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      جاري تحليل الوثيقة واستخراج الأسئلة بالذكاء الاصطناعي...
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div
                      className={`rounded-2xl border p-3 text-xs font-black transition-colors ${
                        progressStep >= 1
                          ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm'
                          : 'border-slate-200 opacity-50'
                      }`}
                    >
                      1. قراءة وتحليل ملف الـ PDF والرسوم
                    </div>
                    <div
                      className={`rounded-2xl border p-3 text-xs font-black transition-colors ${
                        progressStep >= 2
                          ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm'
                          : 'border-slate-200 opacity-50'
                      }`}
                    >
                      2. صياغة المعادلات الرياضية KaTeX
                    </div>
                    <div
                      className={`rounded-2xl border p-3 text-xs font-black transition-colors ${
                        progressStep >= 3
                          ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm'
                          : 'border-slate-200 opacity-50'
                      }`}
                    >
                      3. بناء الخيارات وشروحات الحل
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={startExtraction}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  بدء الاستخراج الذكي
                </button>
              </div>
            </div>
          ) : (
            /* Review & Edit Screen */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    مراجعة وتعديل الأسئلة المستخرجة ({extractedQuestions.length} سؤال)
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    يمكنك تعديل نص السؤال، الخيارات، تحديد الإجابة الصحيحة، ومطالعة تنسيق KaTeX
                    المباشر.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    <Plus size={15} />
                    إضافة سؤال
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractedQuestions([]);
                      setSelectedFile(null);
                      setPromptText('');
                    }}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    رفع ملف جديد
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {extractedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">
                          {idx + 1}
                        </span>
                        <select
                          value={q.difficulty || 'medium'}
                          onChange={(e) => updateQuestion(idx, 'difficulty', e.target.value)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="easy">سهل</option>
                          <option value="medium">متوسط</option>
                          <option value="hard">صعب</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewMode((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          <Eye size={13} />
                          {previewMode[idx] ? 'تحرير' : 'معاينة KaTeX'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(idx)}
                          className="rounded-xl p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="حذف السؤال"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Question Text */}
                    {previewMode[idx] ? (
                      <div
                        className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3.5 text-xs font-bold leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(q.text) }}
                      />
                    ) : (
                      <textarea
                        rows={2}
                        value={q.text}
                        onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                        placeholder="نص السؤال..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold focus:border-indigo-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    )}

                    {/* 4 Options */}
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctAnswer === optIdx;
                        const optionLetters = ['أ', 'ب', 'ج', 'د'];
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${
                              isCorrect
                                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuestion(idx, 'correctAnswer', optIdx)}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black transition-colors ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                              title={isCorrect ? 'الإجابة الصحيحة' : 'تعيين كإجابة صحيحة'}
                            >
                              {optionLetters[optIdx]}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                              className="min-w-0 flex-1 bg-transparent text-xs font-bold focus:outline-none dark:text-slate-100"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">
                        طريقة الحل والشرح النموذجي:
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                        placeholder="شرح الحل والقوانين..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs font-bold focus:border-indigo-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500">
                  سيتم حفظ واعتماد {extractedQuestions.length} سؤال في النظام المدرسي.
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    إغلاق
                  </button>
                  <button
                    type="button"
                    onClick={handlePublish}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
                  >
                    <CheckCircle2 size={16} />
                    نشر واعتماد الاختبار الآن
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
