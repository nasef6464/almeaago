import React, { useState } from 'react';
import { Activity, Download, Copy, CheckCircle2, ChevronRight, Code } from 'lucide-react';
import { xapi } from '../../api/classroom-xapi';
import type { XAPIStatement } from '../../api/classroom-types';

interface XapiAuditLogViewerProps {
  sessionId: string;
}

export const XapiAuditLogViewer: React.FC<XapiAuditLogViewerProps> = ({ sessionId }) => {
  const [statements] = useState<XAPIStatement[]>(() => xapi.getStatements(sessionId));
  const [selectedStatement, setSelectedStatement] = useState<XAPIStatement | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(xapi.exportJson(sessionId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([xapi.exportJson(sessionId)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xapi-statements-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="text-cyan-600 dark:text-cyan-400" size={18} />
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              سجل نشاط xAPI القياسي (Experience API Statements)
            </h4>
            <p className="text-xs font-bold text-slate-500">
              تتبع أكاديمي معياري لكل حركة وانضمام وإجابة وتفاعل مع السبورة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
            نسخ JSON
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-black text-white hover:bg-cyan-700"
          >
            <Download size={14} />
            تصدير xAPI
          </button>
        </div>
      </div>

      {statements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400 dark:border-slate-800">
          لا توجد سجلات xAPI مسجلة لهذه الجلسة حتى الآن.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Statements Feed */}
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {statements.map((stmt) => (
              <button
                key={stmt.id}
                type="button"
                onClick={() => setSelectedStatement(stmt)}
                className={`w-full rounded-2xl border p-3 text-right transition ${
                  selectedStatement?.id === stmt.id
                    ? 'border-cyan-500 bg-cyan-50/70 dark:border-cyan-800 dark:bg-cyan-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-900 dark:text-white">
                    {stmt.actor.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {stmt.verb.display['ar-SA'] || stmt.verb.id}
                  </span>
                </div>

                <div className="mt-1 text-[11px] font-bold text-slate-500 truncate">
                  {stmt.object.definition?.name?.['ar-SA'] || stmt.object.id}
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{new Date(stmt.timestamp).toLocaleTimeString('ar-SA')}</span>
                  {stmt.result?.success !== undefined && (
                    <span
                      className={
                        stmt.result.success
                          ? 'font-bold text-emerald-600'
                          : 'font-bold text-rose-600'
                      }
                    >
                      {stmt.result.success ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Statement Inspector */}
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-cyan-300 shadow-inner dark:border-slate-800 overflow-x-auto max-h-80">
            <div className="flex items-center gap-1.5 pb-2 text-[10px] text-slate-400 border-b border-slate-800">
              <Code size={13} />
              <span>معاينة كود xAPI Statement الرسمي:</span>
            </div>
            <pre className="mt-3 overflow-x-auto text-[11px] leading-5">
              {JSON.stringify(selectedStatement || statements[0] || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
