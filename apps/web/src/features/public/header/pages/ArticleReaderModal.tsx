import React, { useEffect, useState } from 'react';
import { X, Clock, Calendar, BookOpen, Share2, Check, Sparkles, User, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PlatformArticle } from './defaultArticles';

interface ArticleReaderModalProps {
  article: PlatformArticle | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({ article, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !article) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent fallback
    }
  };

  const getCategoryClasses = (color: string) => {
    switch (color) {
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'blue':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'teal':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'purple':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'indigo':
      default:
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-auto max-h-[90vh] flex flex-col z-10 animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${getCategoryClasses(article.categoryColor)}`}>
              <BookOpen size={12} />
              {article.category}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
              <Clock size={12} />
              {article.readTime}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
              <Calendar size={12} />
              {article.date}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="نسخ الرابط"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
              <span>{copied ? 'تم النسخ!' : 'مشاركة'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-right">
          {/* Title and summary */}
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-3">
              {article.title}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {article.summary}
            </p>
          </div>

          {/* Author Capsule */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/40">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              <User size={18} />
            </div>
            <div className="text-right flex-1 min-w-0">
              <div className="text-sm font-black text-slate-900 dark:text-white">{article.authorName}</div>
              <div className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold">{article.authorRole}</div>
            </div>
            <div className="text-[11px] text-slate-400 font-bold hidden sm:block">
              نُشر في {article.date}
            </div>
          </div>

          {/* Highlights Box */}
          {article.highlights && article.highlights.length > 0 && (
            <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-4 sm:p-5">
              <h4 className="text-sm font-black text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                أبرز المحاور والنقاط المستفادة:
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-amber-950 dark:text-amber-100/90 font-medium">
                {article.highlights.map((highlight, idx) => (
                  <li key={`highlight-${idx}`} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-200/80 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Main article paragraphs */}
          <div className="space-y-4 text-slate-700 dark:text-slate-200 text-sm sm:text-base leading-8 font-normal">
            {article.content.map((paragraph, idx) => (
              <p key={`para-${idx}`} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Key Takeaway Box */}
          {article.keyTakeaway && (
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 sm:p-5 flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-sm font-black shadow-sm">
                ★
              </span>
              <div>
                <h5 className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1">
                  الخلاصة الذهبية للمستشار
                </h5>
                <p className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-100 leading-relaxed">
                  {article.keyTakeaway}
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-bold text-slate-400 ml-1">الكلمات الدلالية:</span>
            {article.tags.map((tag, idx) => (
              <span
                key={`tag-${idx}`}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-8 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
          >
            إغلاق المقال
          </button>

          <Link
            to={article.trackId ? `/category/${article.trackId}` : '/mock-exams'}
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-all shadow-md hover:shadow-lg shadow-indigo-600/20"
          >
            <span>ابدأ التدريب في هذا المسار</span>
            <ArrowLeft size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ArticleReaderModal;
