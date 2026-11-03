import React from 'react';

export interface ProgressBarProps {
  percentage?: number;
  progress?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  progress,
  label,
  showPercentage = true,
  color = 'secondary',
  className = '',
}) => {
  const rawValue = percentage ?? progress ?? 0;
  const val = Math.max(0, Math.min(100, Math.round(rawValue)));

  let colorClass = 'bg-secondary-500';
  if (color === 'primary') colorClass = 'bg-indigo-600';
  if (color === 'danger') colorClass = 'bg-red-500';
  if (color === 'warning') colorClass = 'bg-amber-500';
  if (color === 'success') colorClass = 'bg-emerald-500';

  return (
    <div className={`w-full ${className}`} dir="rtl">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && <span className="text-sm font-bold text-gray-600">{val}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={val}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'نسبة الإنجاز'}
        className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden"
      >
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${val}%` }}
        />
      </div>
    </div>
  );
};
