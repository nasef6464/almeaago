import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  ImagePlus,
  Mic,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiClient, type AiChatResult } from '../api/ai-client';
import {
  browserSpeechInputSupported,
  compressImageForAi,
  recognizeArabicOnce,
  speakArabic,
} from '../services/aiMediaClient';
import { normalizeQuestionHtml } from '../../../lib/questionHtml';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  personalized?: boolean;
  weaknessesCount?: number;
  provider?: string;
  model?: string;
  usedFallback?: boolean;
  recommendedLinks?: Array<{ label: string; href: string; skillId: string }>;
  imagePreview?: string;
}

const quickPrompts = [
  'أنا ضعيف في إيه وابدأ أذاكر منين؟',
  'اعمل لي خطة مذاكرة اليوم',
  'اشرح لي فكرة الكسور ببساطة',
  'إزاي أراجع أخطائي بعد الاختبار؟',
];

const providerLabels: Record<string, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  openai: 'OpenAI',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  none: 'احتياطي ذكي',
};

export const ChatWidget: React.FC = () => {
  const tutorSessionIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `student:${crypto.randomUUID()}`
      : `student:${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'مرحبًا! أنا معلّمك الذكي في منصة المئة. يمكنك سؤالي صوتياً أو كتابياً، أو تصوير مسألة رياضية لشرحها خطوة بخطوة.',
      sender: 'bot',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ data: string; mimeType: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setMediaError('');
    try {
      const compressed = await compressImageForAi(file);
      setImageFile({ data: compressed.data, mimeType: compressed.mimeType });
      setImagePreview(compressed.previewUrl);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'تعذر تجهيز الصورة.');
    }
  };

  const handleVoiceInput = async () => {
    if (!browserSpeechInputSupported() || isListening || isLoading) return;
    setMediaError('');
    setIsListening(true);
    try {
      const transcript = await recognizeArabicOnce();
      if (transcript) {
        setInputValue((current) => (current ? `${current} ${transcript}` : transcript));
      }
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'تعذر التقاط الصوت.');
    } finally {
      setIsListening(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const handleSend = async (override?: string) => {
    const text = (override || inputValue).trim();
    if (!text && !imageFile) return;

    const currentImage = imageFile;
    const currentPreview = imagePreview;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text || (currentImage ? '[صورة مسألة]' : ''),
      sender: 'user',
      imagePreview: currentPreview || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    clearImage();
    setIsLoading(true);

    try {
      const resp: AiChatResult = await aiClient.chat({
        message: userMsg.text,
        image: currentImage || undefined,
        tutorSessionId: tutorSessionIdRef.current,
        history: messages.slice(-4).map((m) => ({ sender: m.sender, text: m.text })),
      });

      const replyText = resp.text || resp.reply || 'عذراً، لم أتمكن من استيعاب السؤال.';
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: replyText,
        sender: 'bot',
        personalized: resp.personalized,
        weaknessesCount: resp.weaknessesCount,
        provider: resp.provider,
        model: resp.model,
        usedFallback: resp.usedFallback,
        recommendedLinks: resp.recommendedLinks,
      };
      setMessages((prev) => [...prev, botMsg]);

      if (autoSpeak) {
        speakArabic(replyText);
      }
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: 'حدث خطأ مؤقت أثناء الاتصال بالمساعد الذكي. يرجى إعادة المحاولة.',
        sender: 'bot',
        provider: 'none',
        usedFallback: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="fixed bottom-6 start-6 z-50 select-none">
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:scale-105 active:scale-95"
          aria-label="المساعد الذكي الصوتي"
        >
          <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {isOpen && (
        <div className="flex h-[580px] w-[370px] flex-col rounded-3xl border border-indigo-100 bg-white shadow-2xl shadow-slate-900/15 sm:w-[410px] dark:border-slate-800 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-indigo-50 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 p-4 text-white rounded-t-3xl dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">معلم المئة الذكي</h3>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  مستعد صوتياً وبصرياً
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={`rounded-xl p-2 transition-colors ${
                  autoSpeak ? 'bg-indigo-500/30 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
                title={autoSpeak ? 'النطق الآلي مفعّل' : 'تفعيل النطق الصوتي الآلي'}
              >
                {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-start' : 'items-end'}`}
              >
                {m.imagePreview && (
                  <img
                    src={m.imagePreview}
                    alt="صورة المسألة"
                    className="mb-1 max-h-36 max-w-[200px] rounded-2xl border object-contain"
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 leading-6 ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-bl-none'
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: normalizeQuestionHtml(m.text),
                    }}
                  />
                  {m.sender === 'bot' && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200/60 pt-1.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <span>{providerLabels[m.provider || 'gemini'] || 'Gemini AI'}</span>
                      <button
                        type="button"
                        onClick={() => speakArabic(m.text)}
                        className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                        title="استماع للشرح بصوت المعلم"
                      >
                        <Volume2 size={13} />
                        استمع
                      </button>
                    </div>
                  )}
                </div>

                {m.recommendedLinks && m.recommendedLinks.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.recommendedLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span className="text-[11px] font-bold">المعلم الذكي يفكّر في الحل...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/50">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Error Notice */}
          {mediaError && (
            <div className="px-3 py-1 bg-rose-50 text-[11px] font-bold text-rose-700">
              {mediaError}
            </div>
          )}

          {/* Attached Image Preview */}
          {imagePreview && (
            <div className="relative mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-2 dark:border-slate-800 dark:bg-slate-800/50">
              <img
                src={imagePreview}
                alt="معاينة"
                className="h-12 w-12 rounded-xl object-cover border"
              />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                تم تجهيز صورة المسألة للتحليل البصري
              </span>
              <button
                type="button"
                onClick={clearImage}
                className="ms-auto rounded-lg p-1 text-slate-400 hover:text-rose-600"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="border-t border-slate-100 p-3 bg-white rounded-b-3xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImagePick}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
                title="إرفاق صورة مسألة هندسية"
              >
                <ImagePlus size={18} />
              </button>

              <button
                type="button"
                onClick={handleVoiceInput}
                className={`rounded-2xl p-2.5 transition-colors ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
                title="تحدث بالميكروفون"
              >
                <Mic size={18} />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isListening ? 'أستمع لصوتك الآن...' : 'اكتب سؤالك أو انطق بالميكروفون...'}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={isLoading || (!inputValue.trim() && !imageFile)}
                className="rounded-2xl bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
