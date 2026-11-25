import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { operationsClient } from '../api/operations-client';
import type { BackupExportPayload, BackupExportRecord } from '../api/operations-types';

const collectionLabels: Record<string, string> = {
  paths: 'المسارات التعليمية',
  levels: 'المراحل والصفوف',
  subjects: 'المواد الدراسية',
  skills: 'شجرة المهارات',
  courses: 'الدورات التدريبية',
  lessons: 'الدروس والشروحات',
  questions: 'بنك الأسئلة',
  quizzes: 'الاختبارات والتقييمات',
  library: 'المكتبة والمراجع',
  schools: 'المدارس والمجموعات',
};

export function BackupAdminPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  // Uploaded backup preview
  const [importedBackup, setImportedBackup] = useState<BackupExportPayload | null>(null);
  const [fileName, setFileName] = useState('');

  // Persisted export history from PostgreSQL
  const [snapshots, setSnapshots] = useState<BackupExportRecord[]>([]);

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('admin')) {
      if (!authLoading) setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    operationsClient
      .backups(controller.signal)
      .then((res) => {
        setSnapshots(res.items || []);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل سجل النسخ الاحتياطية');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user, reloadTick]);

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      setError('');
      setFeedback('جاري تجميع بيانات المنصة من خادم PostgreSQL...');

      const csrf = await getCsrfToken();
      const result = await operationsClient.exportBackup(csrf);

      const jsonStr = JSON.stringify(result.payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `almeaa-backup-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (result.exportRecord) {
        setSnapshots((prev) => [result.exportRecord, ...prev.filter((item) => item.id !== result.exportRecord.id)]);
      } else {
        setReloadTick((v) => v + 1);
      }

      const totalItems = result.exportRecord?.totalRecords ?? Object.values(result.payload.summary || {}).reduce((a, b) => a + b, 0);
      setFeedback(`تم تصدير وتنزيل النسخة الاحتياطية بنجاح (${totalItems} عنصر) وتسجيلها في السجل الرسمي.`);
    } catch (err: unknown) {
      setFeedback('');
      setError(err instanceof Error ? err.message : 'تعذر تصدير النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setFeedback('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const parsed = JSON.parse(text) as BackupExportPayload;
        if (parsed.kind !== 'almeaa-platform-backup' || parsed.schemaVersion !== 1 || !parsed.collections) {
          setError('ملف النسخة الاحتياطية غير صالح أو لا يطابق البنية القياسية للمنصة.');
          setImportedBackup(null);
          return;
        }
        setImportedBackup(parsed);
        setFeedback(`تم تحميل ومعاينة ملف "${file.name}" بنجاح.`);
      } catch {
        setError('الملف المرفوع ليس ملف JSON صالحًا.');
        setImportedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  // Direct database restore is intentionally prohibited from the web browser to safeguard production data.
  // Inspection is strictly limited to validating JSON structure and displaying collection summaries.
  const handleValidateSchemaOnly = async () => {
    if (!importedBackup) return;
    setIsRestoring(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const res = await operationsClient.validateBackup(
        {
          kind: importedBackup.kind,
          schemaVersion: importedBackup.schemaVersion,
          summary: importedBackup.summary || {},
          collections: importedBackup.collections || {},
        },
        csrf,
      );
      setFeedback(
        `تم فحص هيكل ملف النسخة بنجاح: تم التحقق من ${res.collectionsCount} مجموعات بيانات بإجمالي ${res.totalRecords} عنصر. (ملاحظة: الاستعادة الفعلية إلى قاعدة البيانات تتطلب أدوات الإدارة عبر CLI).`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة أو التحقق من محتويات ملف النسخة الاحتياطية.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-slate-600">
        جاري تحميل مركز النسخ الاحتياطي والاستعادة...
      </main>
    );
  }

  if (!user || !user.roles.includes('admin')) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        هذه الشاشة لمدير المنصة فقط.
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-200">
              <Database size={14} className="text-amber-400" />
              <span>DATA BACKUP & RECOVERY</span>
            </div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز النسخ الاحتياطي والاستعادة</h1>
            <p className="mt-1 text-xs font-bold text-indigo-200 sm:text-sm">
              تصدير المحتوى التعليمي والمسارات والمدارس كملفات JSON من قاعدة البيانات مع التحقق الهيكلي الآمن.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadTick((v) => v + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-black text-white hover:bg-white/10 transition cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>تحديث السجل</span>
            </button>
            <button
              type="button"
              onClick={() => void handleExportBackup()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-50 transition cursor-pointer"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{isExporting ? 'جاري التصدير...' : 'تصدير نسخة احتياطية كاملة'}</span>
            </button>
          </div>
        </div>
      </header>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-black text-rose-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-700 hover:text-rose-900">✕</button>
        </div>
      ) : null}

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: Create / Export */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">إنشاء وتنزيل نسخة احتياطية</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                توليد ملف متكامل يتضمن كافة جداول المحتوى والتصنيف والمدارس الـ 10 دون أسرار أو كلمات مرور.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-xs font-bold text-slate-700">
            <div className="flex items-center justify-between">
              <span>المحتويات المشمولة:</span>
              <span className="font-black text-indigo-600">كافة الجداول الـ 10 الأساسية</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {Object.entries(collectionLabels).map(([k, label]) => (
                <span key={k} className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleExportBackup()}
            disabled={isExporting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>توليد وتنزيل JSON الآن</span>
          </button>
        </div>

        {/* Box 2: Restore / Upload */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">فحص ملف احتياطي</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                رفع ملف JSON للمعاينة والتحقق الهيكلي للقراءة فقط قبل تنفيذ أي استعادة عبر CLI.
              </p>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 hover:bg-indigo-50/30 hover:border-indigo-300 transition cursor-pointer">
            <FileJson size={32} className="text-indigo-500 mb-2" />
            <span className="text-xs font-black text-slate-800">
              {fileName ? fileName : 'انقر لاختيار ملف النسخة الاحتياطية (.json)'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mt-1">يجب أن يكون الملف مشتقًا من المنصة بنسخة Schema v1</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </label>

          {importedBackup ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-indigo-950">
                <span>معاينة محتويات النسخة:</span>
                <span>تاريخ التوليد: {new Date(importedBackup.createdAt).toLocaleDateString('ar-SA')}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(importedBackup.summary || {}).map(([k, count]) => (
                  <div key={k} className="rounded-xl bg-white border p-2 text-center">
                    <div className="text-sm font-black text-slate-900">{count}</div>
                    <div className="text-[10px] font-bold text-slate-500">{collectionLabels[k] || k}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] font-bold text-amber-900 leading-relaxed">
                ⚠️ <strong>حماية قاعدة البيانات:</strong> استعادة البيانات الفعلية إلى PostgreSQL محظورة من المتصفح لمنع مسح أو تكرار السجلات دون تصريح. تتطلب الاستعادة أدوات سطر الأوامر (CLI) المعتمدة مع التدقيق الأمني لبيانات الاعتماد.
              </div>
              <button
                type="button"
                onClick={() => void handleValidateSchemaOnly()}
                disabled={isRestoring}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-900 disabled:opacity-50 transition cursor-pointer"
              >
                {isRestoring ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                <span>فحص ومطابقة الهيكل فقط (Read-Only)</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Snapshot History Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-500" />
            <h3 className="text-base font-black text-slate-900">سجل النسخ الاحتياطية والتصدير الأخير</h3>
          </div>
          <span className="text-xs font-bold text-slate-500">{snapshots.length} عمليات مسجلة</span>
        </div>

        {snapshots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs font-bold text-slate-500">
            لا توجد عمليات تصدير مسجلة في قاعدة البيانات بعد. اضغط «تصدير نسخة احتياطية كاملة» لإنشاء أول سجل فعلي.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {snapshots.map((snap) => (
              <div key={snap.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900 block">{snap.title}</span>
                  <span className="text-[11px] font-bold text-slate-400 mt-0.5 block">
                    {new Date(snap.createdAt).toLocaleString('ar-SA')}
                    {snap.createdByEmail ? ` · ${snap.createdByEmail}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                    {snap.totalRecords} عنصر
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={13} />
                    <span>مسجل</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
