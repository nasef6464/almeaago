import { useEffect, useRef, useState } from 'react';
import { questionBankClient, type QuestionDetail } from '../api/questionbank-client';

const objectValue = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function QuestionPresentationEditor({ question, getCsrf, onUpdated }: { question: QuestionDetail; getCsrf: () => Promise<string>; onUpdated: (question: QuestionDetail) => void }) {
  const meta = objectValue(question.version.sourceMeta);
  const current = objectValue(meta?.learnerPresentation);
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(typeof current?.questionNumber === 'string' ? current.questionNumber : '');
  const [showNumber, setShowNumber] = useState(current?.showQuestionNumber !== false);
  const [showLabels, setShowLabels] = useState(current?.showOptionLabels !== false);
  const [showText, setShowText] = useState(typeof current?.showOptionText === 'boolean' ? current.showOptionText : !question.version.optionsEmbeddedInImage);
  const [style, setStyle] = useState<'arabic'|'latin'>(current?.optionLabelStyle === 'latin' ? 'latin' : 'arabic');
  const [labels, setLabels] = useState<string[]>(question.options.map((_, index) => Array.isArray(current?.optionLabels) && typeof current.optionLabels[index] === 'string' ? current.optionLabels[index] : ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function save() {
    if (!meta || !objectValue(question.version.aiContext) || !objectValue(question.version.voiceExplanation)) {
      setMessage('تعذر تعديل العرض لأن بيانات إصدار السؤال غير مكتملة.'); return;
    }
    if (!showLabels && question.options.some(option => !(showText && option.text.trim()) && (question.version.optionsEmbeddedInImage || !option.assetId))) {
      setMessage('أظهر رموز الاختيارات أو نصوصًا واضحة لكل اختيار.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const v = question.version;
      const response = await questionBankClient.appendVersion(question.id, question.currentVersion, {
        pathId: question.pathId, subjectId: question.subjectId, type: v.type, text: v.text,
        imageAssetId: v.imageAssetId, imageAlt: v.imageAlt, optionsEmbeddedInImage: v.optionsEmbeddedInImage,
        correctOptionIndex: v.correctOptionIndex, explanation: v.explanation, hint: v.hint,
        solvingStrategy: v.solvingStrategy, videoUrl: v.videoUrl,
        sourceMeta: {...meta, learnerPresentation: {...current, questionNumber: number.trim(), showQuestionNumber: showNumber, showOptionLabels: showLabels, showOptionText: showText, optionLabelStyle: style, optionLabels: labels}},
        aiContext: objectValue(v.aiContext)!, voiceExplanation: objectValue(v.voiceExplanation)!,
        difficulty: v.difficulty, examType: v.examType, source: v.source, year: v.year,
        revisionNote: 'تعديل طريقة عرض السؤال', options: question.options.map(option=>({text:option.text,assetId:option.assetId})), skillLinks: question.skillLinks,
      }, await getCsrf());
      if (mounted.current) { onUpdated(response.question); setOpen(false); }
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : 'تعذر حفظ إعدادات العرض'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
    <button type="button" onClick={()=>setOpen(!open)} className="font-black text-indigo-800">{open ? 'إغلاق إعدادات العرض' : 'تعديل طريقة عرض السؤال'}</button>
    {open ? <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">سيُحفظ التعديل في إصدار جديد من السؤال.</p>
      <label className="block text-xs font-bold">رقم السؤال (اختياري)<input aria-label="رقم السؤال في الإصدار" maxLength={50} value={number} onChange={e=>setNumber(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="block text-xs font-bold">حروف الاختيارات<select aria-label="حروف الاختيارات في الإصدار" value={style} onChange={e=>setStyle(e.target.value as 'arabic'|'latin')} className="mt-1 w-full rounded-lg border p-2"><option value="arabic">أ، ب، ج، د</option><option value="latin">A, B, C, D</option></select></label>
      <div className="flex flex-wrap gap-3 text-xs font-bold"><label><input type="checkbox" checked={showNumber} onChange={e=>setShowNumber(e.target.checked)} /> إظهار رقم السؤال</label><label><input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)} /> إظهار الرموز</label><label><input type="checkbox" checked={showText} onChange={e=>setShowText(e.target.checked)} /> إظهار النصوص</label></div>
      <div className="grid grid-cols-2 gap-2">{labels.map((label,index)=><label key={index} className="text-xs font-bold">رمز الاختيار {index+1}<input aria-label={`رمز الاختيار ${index+1} في الإصدار`} maxLength={24} value={label} onChange={e=>setLabels(old=>old.map((v,i)=>i===index?e.target.value:v))} placeholder={style==='latin'?['A','B','C','D'][index]:['أ','ب','ج','د'][index]} className="mt-1 w-full rounded-lg border p-2" /></label>)}</div>
      {message ? <p role="alert" className="text-xs font-bold text-rose-700">{message}</p> : null}
      <button type="button" disabled={busy} onClick={()=>void save()} className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy?'جارٍ الحفظ...':'حفظ إصدار جديد'}</button>
    </div> : null}
  </section>;
}
