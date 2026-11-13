import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { BoardElement } from './boardState';

const Formula: React.FC<{ content: string }> = ({ content }) => {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(content, {
        displayMode: true,
        throwOnError: false,
        trust: false,
        maxExpand: 100,
        maxSize: 10,
      });
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      dir="ltr"
      className="overflow-x-auto py-2 text-center text-xl sm:text-2xl font-serif text-emerald-200"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const TeachingBoard: React.FC<{
  elements: BoardElement[];
  narration: string;
  language?: string;
}> = ({ elements, narration, language = 'ar-SA' }) => {
  const isArabic = language.startsWith('ar');

  return (
    <div
      className="flex min-h-[320px] flex-col justify-between gap-5 p-4 sm:p-7 bg-slate-950 text-white rounded-2xl select-text"
      data-testid="teaching-board"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="min-h-56 space-y-4" aria-label="خطوات السبورة">
        {elements.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-slate-500 font-bold text-sm">
            السبورة جاهزة للكتابة...
          </div>
        ) : null}

        {elements.map((element) => (
          <div
            key={element.id}
            className={`rounded-2xl px-5 py-3.5 transition-all duration-300 ${
              element.emphasis === 'box'
                ? 'border-2 border-emerald-400/90 bg-emerald-500/15 shadow-lg shadow-emerald-950/40'
                : element.emphasis === 'highlight'
                ? 'border border-amber-400/40 bg-amber-400/15 text-amber-200'
                : 'bg-slate-900/60 border border-slate-800/80 text-slate-100'
            }`}
          >
            <div
              key={element.content}
              className={`teaching-writing ${
                element.kind === 'text' && isArabic ? 'teaching-writing-rtl' : ''
              }`}
              style={
                {
                  '--reveal': `${Math.round(element.progress * 100)}%`,
                } as React.CSSProperties
              }
            >
              {element.kind === 'formula' ? (
                <Formula content={element.content} />
              ) : (
                <p className="whitespace-pre-wrap text-base sm:text-lg font-bold leading-8 text-slate-100">
                  {element.content}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {narration ? (
        <div className="border-t border-slate-800/80 pt-4 mt-2">
          <div className="flex items-start gap-2.5">
            <span className="inline-block mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p
              className="text-sm sm:text-base leading-7 text-slate-300 font-medium"
              aria-live="polite"
              aria-atomic="true"
            >
              {narration}
            </p>
          </div>
        </div>
      ) : null}

      <style>{`
        .teaching-writing {
          clip-path: inset(0 calc(100% - var(--reveal)) 0 0);
          transition: clip-path 0.08s linear;
        }
        .teaching-writing-rtl {
          clip-path: inset(0 0 0 calc(100% - var(--reveal)));
          transition: clip-path 0.08s linear;
        }
        @media (prefers-reduced-motion: reduce) {
          .teaching-writing, .teaching-writing-rtl {
            clip-path: none !important;
          }
        }
      `}</style>
    </div>
  );
};
