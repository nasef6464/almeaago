import React from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Minus,
  MoveUpRight,
  Square,
  Circle,
  Triangle,
  Grid3X3,
  Type,
  Sigma,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
  Grid,
  FileText,
  Moon,
  Sun,
  Radio,
} from 'lucide-react';
import type { WhiteboardTool, WhiteboardTheme } from '../../api/classroom-types';

interface WhiteboardToolbarProps {
  currentTool: WhiteboardTool;
  onSelectTool: (tool: WhiteboardTool) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  theme: WhiteboardTheme;
  onSelectTheme: (theme: WhiteboardTheme) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onOpenFormulaModal: () => void;
  isBroadcastActive?: boolean;
  onToggleBroadcast?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const COLORS = [
  { label: 'أسود / داكن', value: '#1e293b' },
  { label: 'أزرق نيلي', value: '#4f46e5' },
  { label: 'أخضر زمردي', value: '#10b981' },
  { label: 'أحمر قرمزي', value: '#ef4444' },
  { label: 'برتقالي شمسي', value: '#f97316' },
  { label: 'بنفسجي ملكي', value: '#8b5cf6' },
  { label: 'سماوي', value: '#06b6d4' },
  { label: 'أبيض', value: '#ffffff' },
];

const STROKE_WIDTHS = [
  { label: 'رفيع', value: 2 },
  { label: 'متوسط', value: 5 },
  { label: 'عريض', value: 10 },
];

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  currentTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  strokeWidth,
  onSelectStrokeWidth,
  theme,
  onSelectTheme,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onOpenFormulaModal,
  isBroadcastActive = true,
  onToggleBroadcast,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
    >
      {/* Primary Drawing Tools */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          title="قلم رسم حر"
          aria-label="قلم رسم حر"
          onClick={() => onSelectTool('pen')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'pen'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Pen size={18} />
        </button>

        <button
          type="button"
          title="قلم تمييز شفاف (هايلايتر)"
          aria-label="قلم تمييز شفاف (هايلايتر)"
          onClick={() => onSelectTool('highlighter')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'highlighter'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Highlighter size={18} />
        </button>

        <button
          type="button"
          title="ممحاة"
          aria-label="ممحاة"
          onClick={() => onSelectTool('eraser')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'eraser'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Eraser size={18} />
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Geometric Shapes */}
        <button
          type="button"
          title="خط مستقيم"
          aria-label="خط مستقيم"
          onClick={() => onSelectTool('line')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'line'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Minus size={18} className="rotate-45" />
        </button>

        <button
          type="button"
          title="سهم توجيهي"
          aria-label="سهم توجيهي"
          onClick={() => onSelectTool('arrow')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'arrow'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <MoveUpRight size={18} />
        </button>

        <button
          type="button"
          title="مستطيل / مربع"
          aria-label="مستطيل / مربع"
          onClick={() => onSelectTool('rectangle')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'rectangle'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Square size={18} />
        </button>

        <button
          type="button"
          title="دائرة / بيضاوي"
          aria-label="دائرة / بيضاوي"
          onClick={() => onSelectTool('circle')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'circle'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Circle size={18} />
        </button>

        <button
          type="button"
          title="مثلث هندسي"
          aria-label="مثلث هندسي"
          onClick={() => onSelectTool('triangle')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'triangle'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Triangle size={18} />
        </button>

        <button
          type="button"
          title="محاور إحداثية ديكارتية (رسم بياني)"
          aria-label="محاور إحداثية ديكارتية"
          onClick={() => onSelectTool('coordinate_plane')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'coordinate_plane'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Grid3X3 size={18} />
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Text and Formula */}
        <button
          type="button"
          title="ملاحظة نصية"
          aria-label="ملاحظة نصية"
          onClick={() => onSelectTool('text')}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
            currentTool === 'text'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Type size={18} />
        </button>

        <button
          type="button"
          title="معادلة رياضية KaTeX"
          aria-label="معادلة رياضية KaTeX"
          onClick={onOpenFormulaModal}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          <Sigma size={16} />
          معادلة
        </button>
      </div>

      {/* Colors & Widths */}
      <div className="flex items-center gap-2">
        {/* Colors */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => onSelectColor(c.value)}
              className={`h-6 w-6 rounded-lg transition-transform ${
                currentColor === c.value
                  ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1'
                  : 'hover:scale-110'
              }`}
              style={{
                backgroundColor: c.value,
                border: c.value === '#ffffff' ? '1px solid #cbd5e1' : 'none',
              }}
            />
          ))}
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          {STROKE_WIDTHS.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.label}
              onClick={() => onSelectStrokeWidth(s.value)}
              className={`flex h-6 items-center px-2 text-[10px] font-bold rounded-lg transition ${
                strokeWidth === s.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Themes, History & Actions */}
      <div className="flex items-center gap-1.5">
        {/* Theme select */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            title="سبورة بيضاء ناصعة"
            onClick={() => onSelectTheme('white')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              theme === 'white'
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            title="شبكة مربعات رياضية"
            onClick={() => onSelectTheme('math_grid')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              theme === 'math_grid'
                ? 'bg-indigo-600 shadow text-white'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Grid size={15} />
          </button>
          <button
            type="button"
            title="ورق مسطر"
            onClick={() => onSelectTheme('lined')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              theme === 'lined'
                ? 'bg-indigo-600 shadow text-white'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText size={15} />
          </button>
          <button
            type="button"
            title="سبورة سوداء داكنة"
            onClick={() => onSelectTheme('dark_chalkboard')}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              theme === 'dark_chalkboard'
                ? 'bg-slate-900 shadow text-emerald-400'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Moon size={15} />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          title="تراجع"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Undo2 size={16} />
        </button>

        <button
          type="button"
          title="إعادة"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Redo2 size={16} />
        </button>

        <button
          type="button"
          title="مسح السبورة"
          onClick={onClear}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <Trash2 size={16} />
        </button>

        <button
          type="button"
          title="تصدير كصورة PNG"
          onClick={onExport}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download size={16} />
        </button>

        {onToggleBroadcast && (
          <button
            type="button"
            title={isBroadcastActive ? 'بث السبورة مباشر للطلاب والبروجكتور' : 'البث متوقف'}
            onClick={onToggleBroadcast}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
              isBroadcastActive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Radio size={14} className={isBroadcastActive ? 'animate-pulse' : ''} />
            {isBroadcastActive ? 'مبثوث للطلاب' : 'محلية'}
          </button>
        )}

        {onToggleFullscreen && (
          <button
            type="button"
            title="ملء الشاشة"
            onClick={onToggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>
    </div>
  );
};
