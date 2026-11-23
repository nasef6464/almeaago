import React from 'react';
import type { HomepageSettings } from './homepage-types';
import { defaultHomepageSettings } from './homepageManagerDefaults';

const COLOR_SWATCHES = [
    '#111827',
    '#374151',
    '#64748b',
    '#ffffff',
    '#2563eb',
    '#1d4ed8',
    '#4f46e5',
    '#7c3aed',
    '#9333ea',
    '#db2777',
    '#e11d48',
    '#dc2626',
    '#ea580c',
    '#f59e0b',
    '#ca8a04',
    '#84cc16',
    '#16a34a',
    '#059669',
    '#0d9488',
    '#0891b2',
    '#0284c7',
    '#0f172a',
    '#78350f',
    '#14532d',
];

export const normalizeColorPickerValue = (value: string, fallback = '#2563eb') => {
    const raw = String(value || '').trim();
    return /^#([0-9a-f]{6})$/i.test(raw) ? raw : fallback;
};

export const TextField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <input
            aria-label={label}
            title={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-gray-100 disabled:text-gray-400"
        />
    </label>
);

export const ColorField: React.FC<{
    label: string;
    value: string;
    fallback: string;
    onChange: (value: string) => void;
}> = ({ label, value, fallback, onChange }) => {
    const pickerValue = normalizeColorPickerValue(value, fallback);

    return (
        <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-amber-200">
                <input
                    type="color"
                    value={pickerValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"
                    aria-label={label}
                    title={label}
                />
                <input
                    aria-label={`${label} كنص`}
                    title={`${label} كنص`}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    dir="ltr"
                    placeholder={fallback}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                />
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded-lg px-2 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                    افتراضي
                </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} خيارات ألوان جاهزة`}>
                {COLOR_SWATCHES.map((color) => (
                    <button
                        key={`${label}-${color}`}
                        type="button"
                        onClick={() => onChange(color)}
                        className={`h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-110 ${
                            value.toLowerCase() === color.toLowerCase() ? 'border-gray-900 ring-2 ring-amber-300' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`${label} ${color}`}
                        title={color}
                    />
                ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">اختر من اللوحة أو استخدم مربع اللون، وسيظهر كود اللون هنا للحفظ.</p>
        </label>
    );
};

export const TextAreaField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
}> = ({ label, value, onChange, rows = 3 }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <textarea
            aria-label={label}
            title={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-y"
        />
    </label>
);

export const SelectField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </label>
);

export const SummaryCard: React.FC<{
    label: string;
    value: number;
    tone?: 'blue' | 'amber' | 'emerald' | 'slate' | 'violet';
}> = ({ label, value, tone = 'slate' }) => {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
    };

    return (
        <div className={`rounded-2xl border px-4 py-4 ${tones[tone]}`}>
            <div className="text-xs font-bold opacity-80">{label}</div>
            <div className="mt-2 text-2xl font-black">{value}</div>
        </div>
    );
};
