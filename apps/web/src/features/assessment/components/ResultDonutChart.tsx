import React from 'react';

export interface ResultDonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface ResultDonutChartProps {
  data: ResultDonutSlice[];
  colors?: string[];
  primaryColor?: string;
  innerRadius?: number;
  outerRadius?: number;
  cellKeyPrefix?: string;
  centerLabel?: string;
  centerSubLabel?: string;
}

export const ResultDonutChart: React.FC<ResultDonutChartProps> = ({
  data,
  colors = ['#10b981', '#ef4444', '#f59e0b', '#6366f1'],
  primaryColor = '#10b981',
  centerLabel,
  centerSubLabel,
}) => {
  const total = data.reduce((acc, slice) => acc + (slice.value > 0 ? slice.value : 0), 0);

  if (total === 0) {
    return (
      <div className="relative flex items-center justify-center w-full h-full min-h-[160px]">
        <svg viewBox="0 0 100 100" className="w-full h-full max-w-[200px] max-h-[200px]">
          <circle cx="50" cy="50" r="38" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
        </svg>
        <div className="absolute text-center">
          <span className="text-sm font-bold text-slate-400">لا توجد بيانات</span>
        </div>
      </div>
    );
  }

  // Calculate SVG arc paths
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[160px]">
      <svg viewBox="0 0 100 100" className="w-full h-full max-w-[220px] max-h-[220px] -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
        {data.map((slice, index) => {
          if (slice.value <= 0) return null;
          const slicePercent = slice.value / total;
          const strokeDashoffset = circumference * (1 - slicePercent);
          const rotationAngle = accumulatedPercent * 360;
          accumulatedPercent += slicePercent;

          const sliceColor =
            slice.color || (index === 0 ? primaryColor : colors[index % colors.length]);

          return (
            <circle
              key={`${slice.name}-${index}`}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={sliceColor}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transform: `rotate(${rotationAngle}deg)`,
                transformOrigin: '50px 50px',
                transition: 'stroke-dashoffset 0.5s ease-out',
              }}
            />
          );
        })}
      </svg>
      {(centerLabel || centerSubLabel) && (
        <div className="absolute flex flex-col items-center justify-center text-center select-none pointer-events-none">
          {centerLabel && (
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {centerLabel}
            </span>
          )}
          {centerSubLabel && (
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              {centerSubLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
