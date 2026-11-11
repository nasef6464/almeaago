import React from 'react';
import { Download, CheckCircle, FileSpreadsheet, Plus, ShieldAlert, FileText, RefreshCw } from 'lucide-react';
import type { ImportRow } from '../utils/importRowParsing';

export interface ImportSummary {
  totalRows: number;
  imported: number;
  classesTouched: number;
}

export interface ImportCredentialItem {
  name: string;
  email: string;
  password?: string;
  className?: string;
}

export interface SchoolImportPanelProps {
  importRows: ImportRow[];
  importSummary: ImportSummary | null;
  isImporting: boolean;
  importCredentials: ImportCredentialItem[];
  importError: string | null;
  importPreviewStats: {
    classNames: string[];
    rowsWithoutPassword: number;
    duplicateEmails: string[];
    existingEmails: string[];
  };
  handleImportFile: (file: File) => Promise<void>;
  handleStartImport: () => Promise<void>;
  downloadTemplate: () => void;
  downloadCredentials: () => void;
  onReset?: () => void;
}

export const SchoolImportPanel: React.FC<SchoolImportPanelProps> = ({
  importRows,
  importSummary,
  isImporting,
  importCredentials,
  importError,
  importPreviewStats,
  handleImportFile,
  handleStartImport,
  downloadTemplate,
  downloadCredentials,
  onReset,
}) => {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8" dir="rtl">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">كشف الطلاب والفصول (استيراد كشوف نظام نور)</h2>
        <p className="text-sm font-bold text-gray-500 max-w-xl mx-auto">
          ارفع كشف المدرسة كاملاً مرة واحدة بصيغة Excel أو CSV؛ النظام يطابق أسماء الفصول تلقائياً وينشئ غير الموجود ويربط الطلاب بها فوراً.
        </p>
      </div>

      {/* 5-Step Process Indicator */}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 grid-cols-2 sm:grid-cols-5">
        {[
          ['1', 'تحميل النموذج', true],
          ['2', 'رفع الملف', importRows.length > 0 || Boolean(importSummary)],
          ['3', 'معاينة الكشف', importRows.length > 0],
          ['4', 'بدء الاستيراد', Boolean(importSummary)],
          ['5', 'بيانات الدخول', importCredentials.length > 0],
        ].map(([number, label, isDone]) => (
          <div
            key={String(label)}
            className={`rounded-xl border px-3 py-2 text-center transition-all ${
              isDone
                ? 'border-emerald-200 bg-white text-emerald-800 shadow-2xs'
                : 'border-slate-200/60 bg-white/60 text-slate-400'
            }`}
          >
            <span
              className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {number}
            </span>
            <span className="block text-xs font-black">{label}</span>
          </div>
        ))}
      </div>

      {/* Main Actions: 1. Download Template, 2. File Upload Dropzone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-2xl p-6 text-center hover:border-amber-500 transition-colors bg-white shadow-2xs group cursor-pointer flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
              <Download size={30} />
            </div>
            <h3 className="font-black text-gray-900 mb-2">1. تحميل النموذج المعتمد</h3>
            <p className="text-xs font-bold text-gray-500 mb-4 leading-5">
              نموذج Excel جاهز متوافق مع نظام نور بالأعمدة الأساسية: الاسم، البريد (أو السجل المدني)، الفصل، وكلمة المرور الاختيارية.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-black text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <FileSpreadsheet size={16} />
            <span>تحميل school-import-template.csv</span>
          </button>
        </div>

        <div
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors relative overflow-hidden flex flex-col justify-center items-center ${
            importSummary
              ? 'border-emerald-500 bg-emerald-50/70'
              : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 bg-white'
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            aria-label="رفع ملف الكشف"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
            }}
          />

          {isImporting ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="font-black text-indigo-700 text-sm">جارٍ معالجة كشف نور واستيراد الطلاب...</p>
              <p className="text-xs text-slate-500 mt-1">يتم إنشاء الفصول والتحقق من الحسابات</p>
            </div>
          ) : importSummary ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={32} />
              </div>
              <h3 className="font-black text-emerald-900 mb-1 text-base">تم الاستيراد بنجاح</h3>
              <p className="text-xs font-bold text-emerald-700 mb-4">
                تم استيراد {importSummary.imported} طالب وتوزيعهم عبر {importSummary.classesTouched} فصل.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCredentials}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-emerald-700 shadow-sm"
                >
                  <Download size={15} /> تحميل بيانات الدخول (Excel / CSV)
                </button>
                {onReset ? (
                  <button
                    type="button"
                    onClick={onReset}
                    className="border border-emerald-300 bg-white text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-50"
                  >
                    استيراد كشف آخر
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={30} />
              </div>
              <h3 className="font-black text-gray-900 mb-1">2. اسحب ملف الكشف وأفلته هنا</h3>
              <p className="text-xs font-bold text-gray-500 mb-4">
                يدعم كشوفات نظام نور بصيغ (.xlsx, .csv, .tsv) حتى 5,000 طالب
              </p>
              <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-sm pointer-events-none">
                <Plus size={15} /> اختيار ملف من الجهاز
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {importError && (
        <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl border border-rose-200 flex items-start gap-3 text-right">
          <ShieldAlert size={20} className="shrink-0 mt-0.5 text-rose-600" />
          <div>
            <h4 className="font-black text-sm mb-0.5">تنبيه في قراءة الكشف</h4>
            <p className="text-xs font-bold leading-5">{importError}</p>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {importRows.length > 0 && !importSummary && (
        <div className="space-y-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-xs text-gray-500 font-bold mb-1">إجمالي الطلاب بالكشف</p>
              <p className="text-2xl font-black text-indigo-800">{importRows.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-xs text-gray-500 font-bold mb-1">الفصول المستهدفة</p>
              <p className="text-2xl font-black text-purple-800">{importPreviewStats.classNames.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <p className="text-xs text-gray-500 font-bold mb-1">بدون كلمة مرور (توليد آلي)</p>
              <p className="text-2xl font-black text-amber-800">{importPreviewStats.rowsWithoutPassword}</p>
            </div>
            <div
              className={`p-4 rounded-2xl border text-center ${
                importPreviewStats.duplicateEmails.length || importPreviewStats.existingEmails.length
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <p
                className={`text-xs font-bold mb-1 ${
                  importPreviewStats.duplicateEmails.length || importPreviewStats.existingEmails.length
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                تكرار الإيميلات أو السجلات
              </p>
              <p
                className={`text-2xl font-black ${
                  importPreviewStats.duplicateEmails.length || importPreviewStats.existingEmails.length
                    ? 'text-rose-800'
                    : 'text-emerald-800'
                }`}
              >
                {importPreviewStats.duplicateEmails.length + importPreviewStats.existingEmails.length}
              </p>
            </div>
          </div>

          {/* Duplicates Warning */}
          {(importPreviewStats.duplicateEmails.length > 0 || importPreviewStats.existingEmails.length > 0) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold leading-6 text-rose-800">
              {importPreviewStats.duplicateEmails.length > 0 ? (
                <p>
                  <strong>إيميلات مكررة داخل الملف:</strong>{' '}
                  {importPreviewStats.duplicateEmails.slice(0, 6).join(', ')}
                  {importPreviewStats.duplicateEmails.length > 6 ? '...' : ''}
                </p>
              ) : null}
              {importPreviewStats.existingEmails.length > 0 ? (
                <p>
                  <strong>إيميلات موجودة مسبقاً بالنظام:</strong>{' '}
                  {Array.from(new Set(importPreviewStats.existingEmails)).slice(0, 6).join(', ')}
                </p>
              ) : null}
            </div>
          )}

          {/* Table Header and Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div>
              <h3 className="text-base font-black text-gray-900">معاينة أولية لبيانات الكشف</h3>
              <p className="text-xs font-bold text-gray-500">تم فحص {importRows.length} صفاً مطابقاً لصيغة نور.</p>
            </div>
            <div className="flex items-center gap-2">
              {onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  إلغاء الملف
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleStartImport()}
                disabled={isImporting || importPreviewStats.duplicateEmails.length > 0}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                بدء إنشاء حسابات الطلاب والفصول
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 text-gray-600 text-[11px] font-black border-b border-gray-200">
                <tr>
                  <th className="p-3.5">الاسم</th>
                  <th className="p-3.5">البريد الإلكتروني</th>
                  <th className="p-3.5">الفصل المستهدف</th>
                  <th className="p-3.5">كلمة المرور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold">
                {importRows.slice(0, 8).map((row, index) => (
                  <tr key={`${row.email}-${index}`} className="hover:bg-slate-50/50">
                    <td className="p-3.5 text-gray-900 font-black">{row.name}</td>
                    <td className="p-3.5 text-gray-500 font-mono text-[11px]">{row.email}</td>
                    <td className="p-3.5">
                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                        {row.className || 'بدون فصل'}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                      {row.password || 'توليد آلي تلقائي'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importRows.length > 8 && (
              <div className="p-3 text-center text-xs font-bold text-gray-400 bg-gray-50/50 border-t border-gray-100">
                يظهر أول 8 طلاب من إجمالي {importRows.length} طالب في الكشف.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
