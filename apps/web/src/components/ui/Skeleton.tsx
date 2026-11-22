import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base pulse skeleton element with subtle shimmer effect for RTL Arabic UI.
 * Supports light mode and dark mode (dark:bg-slate-700/60) with accessible ARIA tags.
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="جاري التحميل..."
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60 transition-colors ${className}`}
      {...props}
    />
  );
}

/**
 * Header / Banner Skeleton matching page headers and category banners
 */
export function SkeletonBanner({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="جاري تحميل الترويسة..."
      aria-busy="true"
      className={`w-full rounded-3xl bg-slate-200/90 dark:bg-slate-800 p-6 sm:p-8 animate-pulse shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-11 w-48 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

/**
 * Metric KPI Card Skeleton matching dashboard metric grids
 */
export function SkeletonMetricCard({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="جاري تحميل المؤشر..."
      aria-busy="true"
      className={`min-w-0 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs animate-pulse ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20 rounded-md mb-2" />
      <Skeleton className="h-7 w-28 rounded-lg" />
    </div>
  );
}

/**
 * General data table skeleton supporting configurable rows, columns, and column widths
 */
export function SkeletonTable({
  rows = 5,
  columns = 5,
  columnWidths = [],
  className = '',
}: {
  rows?: number;
  columns?: number;
  columnWidths?: string[];
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="جاري تحميل الجدول..."
      aria-busy="true"
      className={`overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs animate-pulse ${className}`}
    >
      {/* Table Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
        <div className="flex items-center justify-between gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`th-${i}`}
              className={`h-4 rounded-md ${columnWidths[i] || 'w-24'}`}
            />
          ))}
        </div>
      </div>
      {/* Table Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="flex items-center justify-between gap-4 p-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className={`h-4 rounded-md ${columnWidths[c] || 'w-20'} ${c === 0 ? 'h-5 w-32' : ''}`}
                style={{ width: columnWidths[c] || `${60 + ((r + c) % 4) * 10}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Composite Skeleton for Category & Catalog pages (e.g. LegacyCategoryPage)
 */
export function CategoryPageSkeleton() {
  return (
    <main
      dir="rtl"
      role="status"
      aria-busy="true"
      aria-label="جاري تحميل المسار..."
      className="bg-gray-50 dark:bg-slate-950 min-h-screen pb-20 font-sans"
    >
      {/* 1. Category Hero Banner Skeleton */}
      <header className="relative overflow-hidden bg-slate-800 dark:bg-slate-900 py-10 sm:py-12 text-center shadow-md animate-pulse">
        <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col items-center">
          <Skeleton className="h-6 w-36 rounded-full bg-white/20 mb-3" />
          <Skeleton className="h-10 w-72 sm:w-96 rounded-xl bg-white/30 mb-3" />
          <Skeleton className="h-4 w-60 sm:w-80 rounded-md bg-white/15" />
        </div>
      </header>

      {/* 2. Subjects / Levels Grid Skeleton */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[140px] rounded-3xl bg-slate-200/90 dark:bg-slate-800 p-5 flex flex-col items-center justify-center space-y-3 animate-pulse shadow-sm"
            >
              <Skeleton className="h-12 w-12 rounded-2xl bg-slate-300 dark:bg-slate-700" />
              <Skeleton className="h-6 w-32 rounded-lg bg-slate-300 dark:bg-slate-700" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-8 rounded-full bg-slate-300 dark:bg-slate-700" />
                <Skeleton className="h-3 w-8 rounded-full bg-slate-300 dark:bg-slate-700" />
                <Skeleton className="h-3 w-8 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>

        {/* 3. Latest Courses Section Skeleton */}
        <section className="mt-16 border-t border-gray-200/80 dark:border-slate-800 pt-12 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-48 rounded-md" />
              <Skeleton className="h-3 w-64 rounded-md" />
            </div>
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm animate-pulse"
              >
                {/* Course Thumbnail */}
                <Skeleton className="h-36 w-full rounded-none" />
                {/* Course Body */}
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                  <Skeleton className="mt-4 h-9 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Composite Skeleton for School Director Dashboard
 */
export function SchoolDirectorDashboardSkeleton() {
  return (
    <div
      dir="rtl"
      role="status"
      aria-busy="true"
      aria-label="جاري تحميل لوحة مدير المدرسة..."
      className="space-y-6 animate-fade-in"
    >
      {/* 1. Header Banner Skeleton */}
      <header className="rounded-3xl bg-slate-800/90 dark:bg-slate-900 p-6 sm:p-8 shadow-xl animate-pulse">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl bg-white/10 shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-44 rounded-md bg-white/20" />
              <Skeleton className="h-8 w-60 rounded-lg bg-white/30" />
              <Skeleton className="h-3 w-72 rounded-md bg-white/15" />
            </div>
          </div>
          <Skeleton className="h-11 w-56 rounded-xl bg-white/20 shrink-0" />
        </div>
      </header>

      {/* 2. 6 Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* 3. Quick Action Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs animate-pulse"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* 4. Benchmark Table Skeleton */}
      <article className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <Skeleton className="h-6 w-44 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
          <Skeleton className="h-7 w-24 rounded-xl" />
        </div>
        <SkeletonTable
          columns={6}
          rows={4}
          columnWidths={['w-28', 'w-24', 'w-16', 'w-16', 'w-32', 'w-12']}
        />
      </article>
    </div>
  );
}

/**
 * Composite Skeleton for Admin Table Pages (Users, Content, Schools)
 */
export function AdminTablePageSkeleton({
  title = 'إدارة البيانات',
  subtitle = 'عرض وتحليل السجلات والتحكم بالصلاحيات',
  columns = 6,
  rows = 8,
  columnWidths = ['w-36', 'w-24', 'w-28', 'w-24', 'w-16', 'w-20'],
}: {
  title?: string;
  subtitle?: string;
  columns?: number;
  rows?: number;
  columnWidths?: string[];
}) {
  return (
    <div
      dir="rtl"
      role="status"
      aria-busy="true"
      aria-label={`جاري تحميل ${title}...`}
      className="space-y-6 animate-pulse"
    >
      {/* 1. Admin Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32 rounded-full mb-2" />
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-3 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* 2. Filter & Search Controls Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
        <div className="w-full sm:w-72">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
      </div>

      {/* 3. Main Data Table Skeleton */}
      <SkeletonTable
        columns={columns}
        rows={rows}
        columnWidths={columnWidths}
      />

      {/* 4. Pagination Footer Skeleton */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-36 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
