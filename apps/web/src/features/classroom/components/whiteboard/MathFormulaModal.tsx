import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Copy } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

const COMMON_SYMBOLS = [
  { label: 'كسر', latex: '\\frac{a}{b}' },
  { label: 'جذر تربيعي', latex: '\\sqrt{x}' },
  { label: 'أس', latex: 'x^{2}' },
  { label: 'دليل سفلي', latex: 'x_{1}' },
  { label: 'معادلة تربيعية', latex: 'ax^2 + bx + c = 0' },
  { label: 'نظرية فيثاغورس', latex: 'a^2 + b^2 = c^2' },
  { label: 'تكامل', latex: '\\int_{a}^{b} f(x) dx' },
  { label: 'مجموع', latex: '\\sum_{i=1}^{n} x_i' },
  { label: 'نهاية', latex: '\\lim_{x \\to \\infty} f(x)' },
  { label: 'π باي', latex: '\\pi' },
  { label: 'θ ثيتا', latex: '\\theta' },
  { label: 'متجه', latex: '\\vec{v}' },
  { label: 'أكبر أو يساوي', latex: '\\ge' },
  { label: 'أصغر أو يساوي', latex: '\\le' },
  { label: 'لا يساوي', latex: '\\neq' },
  { label: 'تقريباً', latex: '\\approx' },
];

export const MathFormulaModal: React.FC<MathFormulaModalProps> = ({ isOpen, onClose, onInsert }) => {
  const [latex, setLatex] = useState('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');

  useEffect(() => {
    try {
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: true,
      });
      setRenderedHtml(html);
      setRenderError('');
    } catch (err: any) {
      setRenderError(err?.message || 'خطأ في صياغة المعادلة الرياضية');
    }
  }, [latex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
      <div className="flex w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">إدراج معادلة وصيغة رياضية (KaTeX)</h3>
              <p className="text-xs font-bold text-slate-500">اكتب صيغة LaTeX أو اختر من القوالب الجاهزة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live KaTeX Preview Box */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-950/60">
          <div className="text-xs font-bold text-slate-400 mb-2">معاينة المعادلة المباشرة</div>
          {renderError ? (
            <div className="text-xs font-bold text-rose-500">{renderError}</div>
          ) : (
            <div
              dir="ltr"
              className="overflow-x-auto py-2 text-2xl text-slate-900 dark:text-slate-100"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>

        {/* Quick Insert Buttons */}
        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500 mb-2">قوالب ورموز شائعة:</div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
            {COMMON_SYMBOLS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setLatex((prev) => (prev ? `${prev} + ${item.latex}` : item.latex))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* LaTeX Code Input */}
        <div className="mt-4">
          <label htmlFor="latex-code" className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            صيغة LaTeX:
          </label>
          <textarea
            id="latex-code"
            rows={3}
            dir="ltr"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-3 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="\frac{a}{b}"
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!latex.trim() || Boolean(renderError)}
            onClick={() => {
              onInsert(latex);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Plus size={16} />
            إدراج على السبورة
          </button>
        </div>
      </div>
    </div>
  );
};
