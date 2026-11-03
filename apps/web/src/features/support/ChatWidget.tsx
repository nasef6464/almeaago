import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, ImagePlus, Mic, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  personalized?: boolean;
  weaknessesCount?: number;
  provider?: string;
  model?: string;
  usedFallback?: boolean;
  recommendedLinks?: Array<{ label: string; href: string; skillId?: string }>;
}

const quickPrompts = [
  'أنا ضعيف في إيه وابدأ أذاكر منين؟',
  'اعمل لي خطة مذاكرة اليوم',
  'اشرح لي فكرة الكسور ببساطة',
  'إزاي أراجع أخطائي بعد الاختبار؟',
];

const buildLocalStudentReply = (message: string): string => {
  const normalized = message.trim().toLowerCase();
  const isQuant = /كمي|رياض|معادل|كسور|نسبة|نسب|مسائل|حساب|جبر/.test(normalized);
  const isVerbal = /لفظ|قراءة|نص|معنى|مرادف|استيعاب|سياق/.test(normalized);
  const isStudy = /أذاكر|اذاكر|مذاكر|خطة|جدول|اليوم|ابدأ|ابدا/.test(normalized);

  if (isStudy) {
    return [
      'خطة مقترحة لليوم:',
      '1. راجع فكرة واحدة فقط لمدة 10 دقائق.',
      '2. حل 5 أسئلة سهلة لتثبيت الفكرة.',
      '3. حل 5 أسئلة متوسطة وسجل الأخطاء.',
      '4. أعد سؤالين أخطأت فيهما بدون النظر للحل.',
      isQuant ? '💡 ابدأ في الكمي بالكسور والنسب لأنها تتكرر دائماً في الاختبار.' : '',
      isVerbal ? '💡 ابدأ في اللفظي بفهم الفكرة الرئيسية ومعاني الكلمات من السياق.' : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (isQuant) {
    return [
      'خلينا نمشي في الكمي خطوة بخطوة:',
      '1. حدد المطلوب في السؤال قبل أي حساب.',
      '2. اكتب المعطيات كأرقام أو علاقة بسيطة.',
      '3. جرّب طريقة سريعة: تعويض، تبسيط كسر، أو تجريب الاختيارات.',
      '4. بعد الحل تأكد هل الإجابة منطقية مقارنة بالخيارات؟',
      'اكتب لي نص السؤال وسأساعدك في خطوات حله بالتفصيل.',
    ].join('\n');
  }

  if (isVerbal) {
    return [
      'في القسم اللفظي ركز على المعنى العام:',
      '1. اقرأ الجملة أو الفقرة مرة للفهم العام.',
      '2. حدد الكلمة المفتاحية أو علاقة السبب والنتيجة.',
      '3. استبعد الاختيارات البعيدة تماماً عن السياق.',
      '4. اختر الإجابة التي تخدم معنى الجملة بأكملها.',
    ].join('\n');
  }

  return [
    'أنا معك لمساعدتك في الاستعداد للاختبار.',
    'اكتب لي السؤال أو المهارة التي تريد فهمها، وسأقسمها لك إلى:',
    '1. الفكرة الأساسية والقانون.',
    '2. مثال محلول سريع.',
    '3. تدريب قصير للتأكد من فهمك.',
  ].join('\n');
};

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'مرحبًا بك! أنا مساعدك الذكي في منصة المئة. اكتب المهارة أو السؤال، وسأقترح لك شرحًا وخطوة تدريب مناسبة فوراً.',
      sender: 'bot',
      provider: 'local',
      usedFallback: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (override?: string) => {
    const text = (override || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
      const response = await fetch(`${BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const botReply: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply || data.text || buildLocalStudentReply(text),
          sender: 'bot',
          personalized: data.personalized,
          weaknessesCount: data.weaknessesCount,
          recommendedLinks: data.recommendedLinks,
        };
        setMessages((prev) => [...prev, botReply]);
      } else {
        throw new Error('API offline');
      }
    } catch {
      // Deterministic Offline Intelligent Fallback
      const localText = buildLocalStudentReply(text);
      const botReply: Message = {
        id: (Date.now() + 1).toString(),
        text: localText,
        sender: 'bot',
        usedFallback: true,
      };
      setMessages((prev) => [...prev, botReply]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 md:bottom-8 left-4 md:left-8 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-xl transition-all z-50 flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label="فتح المساعد الذكي"
        title="المساعد الذكي الفوري"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div
          dir="rtl"
          className="fixed bottom-36 md:bottom-24 left-4 md:left-8 w-[92vw] sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[70vh] sm:max-h-[520px] animate-fade-in"
        >
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-amber-300" />
              <h3 className="font-bold text-base">المساعد الذكي الفوري</h3>
            </div>
            <span className="text-[11px] bg-white/20 px-2.5 py-1 rounded-full font-bold">مرشد الطالب</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-bl-xs'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-br-xs'
                  }`}
                >
                  {msg.personalized && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <Sparkles size={12} />
                      مبني على مستواك
                    </div>
                  )}
                  <div className="whitespace-pre-line font-medium">{msg.text}</div>
                  {msg.recommendedLinks && msg.recommendedLinks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                      {msg.recommendedLinks.map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setIsOpen(false)}
                          className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl flex items-center gap-2 text-gray-500 text-xs font-bold shadow-xs">
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  جاري التفكير والتوجيه...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 space-y-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSend(prompt)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                placeholder="اكتب سؤالك أو المهارة..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                disabled={isLoading}
              />
              <button
                onClick={() => void handleSend()}
                disabled={isLoading || !inputValue.trim()}
                className="bg-indigo-600 text-white p-2.5 rounded-full hover:bg-indigo-700 disabled:opacity-50 transition"
                aria-label="إرسال"
              >
                <Send size={16} className="rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
