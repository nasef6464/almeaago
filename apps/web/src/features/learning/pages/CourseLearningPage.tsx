import {CheckCircle2,ChevronLeft,Loader2,PauseCircle,PlayCircle} from 'lucide-react';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';

import {useAuth} from '../../auth/state/AuthProvider';
import {contentClient} from '../../content/api/content-client';
import type {LearnerCourse,LearnerLessonDetail,LearnerLessonSummary} from '../../content/api/content-types';
import {lessonProgressClient,type LessonProgress} from '../api/learning-client';

function flattenLessons(course:LearnerCourse|null){
  if(!course)return [] as LearnerLessonSummary[];
  return course.modules.flatMap(module=>module.lessons);
}

export function CourseLearningPage(){
  const{courseId=''}=useParams();
  const{user,loading:authLoading,getCsrfToken}=useAuth();
  const[course,setCourse]=useState<LearnerCourse|null>(null);
  const[lessonId,setLessonId]=useState('');
  const[detail,setDetail]=useState<LearnerLessonDetail|null>(null);
  const[progress,setProgress]=useState<LessonProgress|null>(null);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[notice,setNotice]=useState('');
  const[error,setError]=useState('');
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const lastSaved=useRef(0);

  const lessons=useMemo(()=>flattenLessons(course),[course]);
  const selectedSummary=lessons.find(x=>x.id===lessonId)||null;
  const context=useMemo(()=>({contextType:'course' as const,courseId,topicId:''}),[courseId]);

  useEffect(()=>{
    if(authLoading||!user||!courseId)return;
    const c=new AbortController();setLoading(true);setError('');
    contentClient.learnerCourse(courseId,c.signal)
      .then(r=>{
        setCourse(r.course);
        const first=r.course.modules.flatMap(m=>m.lessons).find(x=>(!x.isLocked&&!x.commerceLocked)||x.isPreview);
        if(first)setLessonId(current=>current||first.id);
      })
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الدورة')})
      .finally(()=>{if(!c.signal.aborted)setLoading(false)});
    return()=>c.abort();
  },[authLoading,courseId,user]);

  useEffect(()=>{
    if(!lessonId||!courseId)return;
    if((selectedSummary?.isLocked||selectedSummary?.commerceLocked)&&!selectedSummary.isPreview){
      setDetail(null);setProgress(null);return;
    }
    const c=new AbortController();setError('');setNotice('');
    Promise.all([
      contentClient.learnerCourseLesson(courseId,lessonId,c.signal),
      lessonProgressClient.get(lessonId,context,c.signal),
    ]).then(([lessonResult,progressResult])=>{
      setDetail(lessonResult.lesson);
      setProgress(progressResult.progress);
      lastSaved.current=progressResult.progress.positionSeconds||0;
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الدرس')});
    return()=>c.abort();
  },[context,courseId,lessonId,selectedSummary?.commerceLocked,selectedSummary?.isLocked,selectedSummary?.isPreview]);

  async function persistVideoPosition(position:number,quiet=false){
    if(!detail||detail.type!=='video'||saving)return;
    const seconds=Math.max(0,Math.floor(position||0));
    if(Math.abs(seconds-lastSaved.current)<1)return;
    setSaving(true);
    try{
      const csrf=await getCsrfToken();
      const r=await lessonProgressClient.saveVideo(detail.id,context,seconds,csrf);
      setProgress(r.progress);lastSaved.current=r.progress.positionSeconds;
      if(!quiet)setNotice('تم حفظ موضع المشاهدة.');
    }catch(e){if(!quiet)setError(e instanceof Error?e.message:'تعذر حفظ موضع المشاهدة')}
    finally{setSaving(false)}
  }

  function onTimeUpdate(){
    const current=Math.floor(videoRef.current?.currentTime||0);
    if(current-lastSaved.current>=15)void persistVideoPosition(current,true);
  }

  async function complete(){
    if(!detail)return;
    setError('');
    try{
      if(detail.type==='video'&&videoRef.current){
        await persistVideoPosition(videoRef.current.currentTime,true);
      }
      setSaving(true);
      const csrf=await getCsrfToken();
      const r=await lessonProgressClient.complete(detail.id,context,csrf);
      setProgress(r.progress);setNotice('تم تسجيل الدرس كمكتمل.');
    }catch(e){setError(e instanceof Error?e.message:'تعذر إكمال الدرس')}
    finally{setSaving(false)}
  }

  useEffect(()=>()=>{const v=videoRef.current;if(v&&detail?.type==='video'&&Math.abs(Math.floor(v.currentTime)-lastSaved.current)>=1){void persistVideoPosition(v.currentTime,true)}},[detail]);

  if(authLoading||loading)return <main className="p-10 text-center font-black">جاري تحميل الدورة...</main>;
  if(!user||!user.roles.includes('student'))return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  if(error&&!course)return <main className="p-10 text-center font-black text-rose-700">{error}</main>;
  if(!course)return <main className="p-10 text-center font-black">الدورة غير متاحة.</main>;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6">
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-950 p-4 text-white"><div className="text-xs font-black text-amber-400">COURSE LEARNING</div><h1 className="mt-1 text-lg font-black">{course.title}</h1></div>
        <div className="max-h-[70vh] overflow-y-auto">
          {course.modules.map(module=><section key={module.id} className="border-b last:border-b-0"><h2 className="bg-gray-50 px-4 py-2 text-xs font-black text-gray-500">{module.title}</h2>{module.lessons.map(lesson=>{
            const locked=(lesson.isLocked||lesson.commerceLocked)&&!lesson.isPreview;
            return <button key={lesson.id} type="button" disabled={locked} onClick={()=>setLessonId(lesson.id)} className={`flex w-full items-center justify-between gap-2 border-t px-4 py-3 text-right text-sm ${lesson.id===lessonId?'bg-indigo-50 text-indigo-900':'bg-white'} disabled:cursor-not-allowed disabled:opacity-45`}><span className="font-bold">{lesson.title}</span><span className="text-[11px] font-black">{locked?'مغلق':lesson.type==='video'?'فيديو':'درس'}</span></button>
          })}</section>)}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"><div><Link to="/" className="text-xs font-black text-indigo-600">المنصة</Link><h2 className="mt-1 text-xl font-black text-gray-900">{detail?.title||selectedSummary?.title||'اختر درسًا'}</h2>{progress?<p className="mt-1 text-xs font-bold text-gray-500">{progress.status==='completed'?'مكتمل':progress.status==='in_progress'?`قيد التقدم · آخر موضع ${progress.positionSeconds} ثانية`:'لم يبدأ بعد'}</p>:null}</div>{progress?.status==='completed'?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"><CheckCircle2 size={15}/>مكتمل</span>:null}</div>
        {error?<div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
        {notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}
        {!course.access.allowed?<div data-testid="course-commerce-lock" className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">{course.access.configured?'هذه الدورة مدفوعة وتحتاج صلاحية وصول فعالة. يمكنك مشاهدة المعاينات المجانية فقط.':'سياسة الوصول التجارية لهذه الدورة غير مكتملة؛ تم قفل المحتوى غير المجاني احترازيًا.'}</div>:null}

        {(selectedSummary?.isLocked||selectedSummary?.commerceLocked)&&!selectedSummary.isPreview?<div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 font-bold text-amber-900">{selectedSummary?.commerceLocked?'هذا الدرس يحتاج شراءً أو منحة وصول فعالة من Commerce.':'هذا الدرس مقفول بسياسة المحتوى الحالية.'}</div>:detail?<article className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm leading-7 text-gray-600">{detail.description}</p>
          {detail.type==='video'&&detail.videoSource==='upload'&&detail.videoUrl?<div className="mt-4 space-y-3"><video ref={videoRef} data-testid="lesson-video" src={detail.videoUrl} controls className="aspect-video w-full rounded-xl bg-black" onLoadedMetadata={()=>{const v=videoRef.current;if(v&&progress?.positionSeconds&&v.currentTime===0)v.currentTime=Math.min(progress.positionSeconds,Number.isFinite(v.duration)?v.duration:progress.positionSeconds)}} onTimeUpdate={onTimeUpdate} onPause={()=>{const v=videoRef.current;if(v)void persistVideoPosition(v.currentTime)}}/><div className="flex items-center gap-2 text-xs font-bold text-gray-500">{saving?<Loader2 size={15} className="animate-spin"/>:<PauseCircle size={15}/>}موضع الاستئناف يُحفظ دوريًا وعند الإيقاف. تغيير الموضع وحده لا يُكمل الدرس.</div></div>:null}
          {detail.type==='video'&&detail.videoSource!=='upload'?<div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-900"><PlayCircle size={18} className="mb-2"/>المصدر {detail.videoSource||'خارجي'} متاح كرابط محتوى، لكن resume الآلي عبر SDK الخاص بالمزود مؤجل عن هذه الدفعة. إكمال الدرس يظل خطوة صريحة منفصلة.</div>:null}
          {detail.type==='text'&&detail.contentText?<div className="mt-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-8 text-gray-800">{detail.contentText}</div>:null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-xs font-bold text-gray-500">{detail.durationSeconds>0?`مدة مرجعية: ${detail.durationSeconds} ثانية`:'بدون مدة محددة'}</span><button type="button" disabled={saving||progress?.status==='completed'} onClick={()=>void complete()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white disabled:opacity-45">{saving?<Loader2 size={17} className="animate-spin"/>:<CheckCircle2 size={17}/>}تحديد كمكتمل</button></div>
        </article>:<div className="rounded-2xl border border-dashed bg-white p-8 text-center font-bold text-gray-500">اختر درسًا متاحًا.</div>}
        <div className="text-left"><Link to="/review" className="inline-flex items-center gap-1 text-sm font-black text-indigo-600">المراجعة الذكية <ChevronLeft size={16}/></Link></div>
      </section>
    </div>
  </main>;
}
