import React from 'react';

type Counter = {
  label: string;
  compactLabel?: string;
  value: number;
  tone?: 'indigo' | 'emerald' | 'amber';
  active?: boolean;
  onClick?: () => void;
};
const tones = {
  indigo: { idle: 'text-indigo-700 hover:bg-indigo-50', active: 'bg-indigo-100 text-indigo-900 ring-1 ring-inset ring-indigo-300' },
  emerald: { idle: 'text-emerald-700 hover:bg-emerald-50', active: 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-300' },
  amber: { idle: 'text-amber-800 hover:bg-amber-50', active: 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-300' },
};

/** One compact row; interactive counters double as the existing content filters. */
export function LearningCatalogCounters({ label, items }: { label: string; items: Counter[] }) {
  return <div role="group" aria-label={label} className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:gap-2 sm:p-1.5">
    {items.map(item => {
      const tone = tones[item.tone || 'indigo'];
      const content = <>
        <span className="min-w-0 text-[11px] font-bold leading-4 sm:text-xs">
          {item.compactLabel ? <><span className="sm:hidden">{item.compactLabel}</span><span className="hidden sm:inline">{item.label}</span></> : item.label}
        </span>
        <span className="text-base font-black leading-5 tabular-nums sm:text-lg"><bdi>{item.value}</bdi></span>
      </>;
      const classes = `flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-center sm:flex-row sm:gap-2 sm:px-3 ${item.active ? tone.active : tone.idle}`;
      return item.onClick ? <button key={item.label} type="button" aria-label={`${item.label}: ${item.value}`} aria-pressed={Boolean(item.active)}
        onClick={item.onClick} className={`${classes} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1`}>{content}</button>
        : <div key={item.label} className={classes}>{content}</div>;
    })}
  </div>;
}
