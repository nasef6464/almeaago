import{BarChart3,CheckCircle2,ChevronLeft,Clock3,Loader2,Play,Presentation,Radio,RefreshCcw,Search,Send,Square,Trophy,UserCheck,Users}from'lucide-react';
import{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Link}from'react-router-dom';
import{useAuth}from'../../auth/state/AuthProvider';
import{contentClient}from'../../content/api/content-client';
import{organizationsClient,type RosterMember,type TeacherWorkspace,type TeacherWorkspaceAssignment,type TeacherWorkspaceSchool}from'../../organizations/api/organizations-client';
import{classroomClient}from'../api/classroom-client';
import type{ClassroomAttendance,ClassroomAttendanceStatus,ClassroomCompetition,ClassroomPresentation,ClassroomPublishedMode,ClassroomQuestionSummary,ClassroomReport,ClassroomSession}from'../api/classroom-types';
import{ClassroomJoinQR}from'../components/ClassroomJoinQR';

type Scope={school:TeacherWorkspaceSchool;assignment:TeacherWorkspaceAssignment};
const attendanceLabel:Record<ClassroomAttendanceStatus,string>={present:'حاضر',late:'متأخر',absent:'غائب',excused:'بعذر'};

export function ClassroomTeacherPage(){
 const{user,loading:authLoading,getCsrfToken}=useAuth();
 const[workspace,setWorkspace]=useState<TeacherWorkspace|null>(null);
 const[subjectNames,setSubjectNames]=useState<Record<string,string>>({});
 const[scope,setScope]=useState<Scope|null>(null);
 const[questions,setQuestions]=useState<ClassroomQuestionSummary[]>([]);
 const[selected,setSelected]=useState<string[]>([]);
 const[search,setSearch]=useState('');
 const[session,setSession]=useState<ClassroomSession|null>(null);
 const[pin,setPin]=useState('');
 const[presentation,setPresentation]=useState<ClassroomPresentation|null>(null);
 const[attendance,setAttendance]=useState<ClassroomAttendance|null>(null);
 const[roster,setRoster]=useState<RosterMember[]>([]);
 const[competition,setCompetition]=useState<ClassroomCompetition|null>(null);
 const[challengeDuration,setChallengeDuration]=useState(60);
 const[clockTick,setClockTick]=useState(0);
 const[report,setReport]=useState<ClassroomReport|null>(null);
 const[mode,setMode]=useState<ClassroomPublishedMode>('single');
 const[busy,setBusy]=useState('load');
 const[error,setError]=useState('');
 const[notice,setNotice]=useState('');
 const socketRef=useRef<WebSocket|null>(null);

 const loadWorkspace=useCallback(async()=>{
  setBusy('load');setError('');
  try{
   const[w,t,sessions]=await Promise.all([organizationsClient.teacherWorkspace(),contentClient.taxonomyCore(),classroomClient.teacherSessions()]);
   setWorkspace(w);setSubjectNames(Object.fromEntries(t.subjects.map(x=>[x.id,x.name])));
   const firstSchool=w.schools[0],firstAssignment=firstSchool?.assignments[0];
   if(firstSchool&&firstAssignment)setScope(current=>current??{school:firstSchool,assignment:firstAssignment});
   const active=sessions.sessions.find(x=>x.status==='live')||sessions.sessions.find(x=>x.status==='draft'||x.status==='scheduled');
   if(active)setSession(current=>current??active);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل مساحة الفصل الذكي')}
  finally{setBusy('')}
 },[]);
 useEffect(()=>{if(!authLoading&&user)void loadWorkspace()},[authLoading,user,loadWorkspace]);

 useEffect(()=>{
  if(!session?.id)return;
  setPin(current=>current||sessionStorage.getItem('almeaa:classroom:pin:'+session.id)||'');
 },[session?.id]);

 const loadQuestions=useCallback(async()=>{
  if(!scope)return;setError('');
  try{const result=await classroomClient.questions({schoolId:scope.school.schoolId,classId:scope.assignment.classId,subjectId:scope.assignment.subjectId,search,limit:30});setQuestions(result.items)}
  catch(e){setQuestions([]);setError(e instanceof Error?e.message:'تعذر تحميل أسئلة الحصة')}
 },[scope,search]);
 useEffect(()=>{if(scope)void loadQuestions()},[scope,loadQuestions]);

 useEffect(()=>{
  if(!scope){setRoster([]);return}
  const controller=new AbortController();
  organizationsClient.students(scope.school.schoolId,scope.assignment.classId,controller.signal)
   .then(x=>setRoster(x.members)).catch(()=>{if(!controller.signal.aborted)setRoster([])});
  return()=>controller.abort();
 },[scope?.school.schoolId,scope?.assignment.classId]);

 const refreshLive=useCallback(async()=>{
  if(!session)return;
  try{
   if(session.status==='ended'||session.status==='archived'){const x=await classroomClient.report(session.id);setReport(x.report);return}
   if(session.status==='live'){
    const[p,a,k]=await Promise.all([
     classroomClient.presentation(session.id),
     classroomClient.attendanceSnapshot(session.id),
     classroomClient.competition(session.id),
    ]);
    setPresentation(p.presentation);setAttendance(a.attendance);setCompetition(k.competition);
    setSession(current=>current?{...current,status:p.presentation.status,activeBatchId:p.presentation.activeBatchId,activeQuestionOrdinal:p.presentation.activeQuestionOrdinal}:current);
   }
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الحالة الحية')}
 },[session?.id,session?.status]);

 useEffect(()=>{
  socketRef.current?.close();socketRef.current=null;
  if(!session||session.status!=='live')return;
  let closed=false;let timer:number|undefined;
  const connect=()=>{
   if(closed)return;
   try{
    const ws=classroomClient.websocket(session.id);socketRef.current=ws;
    ws.onmessage=()=>void refreshLive();
    ws.onopen=()=>void refreshLive();
    ws.onclose=()=>{if(!closed)timer=window.setTimeout(connect,1500)};
    ws.onerror=()=>ws.close();
   }catch{timer=window.setTimeout(connect,2500)}
  };
  connect();void refreshLive();
  const poll=window.setInterval(()=>void refreshLive(),5000);
  return()=>{closed=true;if(timer)window.clearTimeout(timer);window.clearInterval(poll);socketRef.current?.close();socketRef.current=null}
 },[session?.id,session?.status,refreshLive]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setClockTick(x=>x+1),1000);
  return()=>window.clearInterval(timer);
 },[]);

 const activeQuestion=useMemo(()=>presentation?.questions.find(q=>q.ordinal===presentation.activeQuestionOrdinal)||presentation?.questions[0]||null,[presentation]);
 const activeAggregate=useMemo(()=>presentation?.aggregate.questions.find(q=>q.ordinal===presentation.activeQuestionOrdinal)||null,[presentation]);
 const rosterById=useMemo(()=>new Map(roster.map(x=>[x.userId,x])),[roster]);
 const challenge=presentation?.challenge||competition?.state||null;
 const challengeRemaining=useMemo(()=>{
  void clockTick;if(!challenge?.timerEndsAt||challenge.expired)return 0;
  return Math.max(0,Math.ceil((Date.parse(challenge.timerEndsAt)-Date.now())/1000));
 },[challenge?.timerEndsAt,challenge?.expired,clockTick]);

 function chooseScope(school:TeacherWorkspaceSchool,assignment:TeacherWorkspaceAssignment){setScope({school,assignment});setSelected([]);setSession(null);setPin('');setPresentation(null);setAttendance(null);setCompetition(null);setReport(null)}
 function toggle(id:string){setSelected(rows=>rows.includes(id)?rows.filter(x=>x!==id):rows.length>=30?rows:[...rows,id])}
 async function create(){
  if(!scope||selected.length===0)return;setBusy('create');setError('');setNotice('');
  try{const csrf=await getCsrfToken();const out=await classroomClient.create({schoolId:scope.school.schoolId,classId:scope.assignment.classId,subjectId:scope.assignment.subjectId,questionIds:selected,day:'',period:null,publishedMode:mode},csrf);setSession(out.session);setPin(out.pin);sessionStorage.setItem('almeaa:classroom:pin:'+out.session.id,out.pin);setNotice('تم إنشاء الحصة. PIN وQR جاهزان؛ الخادم وحده يتحقق من عضوية الطالب.')}
  catch(e){setError(e instanceof Error?e.message:'تعذر إنشاء الحصة')}finally{setBusy('')}
 }
 async function start(){
  if(!session)return;setBusy('start');setError('');
  try{const csrf=await getCsrfToken();const out=await classroomClient.start(session.id,session.revision,csrf);setSession(out.session);setNotice('الحصة مباشرة الآن. يمكن للطلاب الانضمام بالرمز أو QR.')}
  catch(e){setError(e instanceof Error?e.message:'تعذر بدء الحصة')}finally{setBusy('')}
 }
 async function publish(ordinal=0){
  if(!session)return;setBusy('publish');setError('');
  try{const csrf=await getCsrfToken();const out=await classroomClient.publish(session.id,ordinal,csrf);setSession(out.session);await refreshLive()}
  catch(e){setError(e instanceof Error?e.message:'تعذر نشر السؤال')}finally{setBusy('')}
 }
 async function reveal(){
  if(!session||session.activeQuestionOrdinal===null)return;setBusy('reveal');setError('');
  try{const csrf=await getCsrfToken();await classroomClient.reveal(session.id,session.activeQuestionOrdinal,csrf);await refreshLive()}
  catch(e){setError(e instanceof Error?e.message:'تعذر إظهار الحل')}finally{setBusy('')}
 }
 async function changeAttendance(studentId:string,status:ClassroomAttendanceStatus){
  if(!session)return;setBusy('attendance:'+studentId);setError('');
  try{const csrf=await getCsrfToken();await classroomClient.attendance(session.id,studentId,status,csrf);await refreshLive()}
  catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الحضور')}finally{setBusy('')}
 }
 async function startChallenge(){
  if(!session?.activeBatchId)return;setBusy('challenge');setError('');
  try{const csrf=await getCsrfToken();await classroomClient.configureCompetition(session.id,challengeDuration,csrf);setNotice('بدأ التحدي. المؤقت والخادم يحددان نافذة الإجابة دون نقاط سرعة.');await refreshLive()}
  catch(e){setError(e instanceof Error?e.message:'تعذر بدء التحدي')}finally{setBusy('')}
 }
 async function stopChallenge(){
  if(!session)return;setBusy('challenge');setError('');
  try{const csrf=await getCsrfToken();await classroomClient.endCompetition(session.id,csrf);await refreshLive()}
  catch(e){setError(e instanceof Error?e.message:'تعذر إنهاء التحدي')}finally{setBusy('')}
 }
 async function endBatch(){
  if(!session?.activeBatchId)return;setBusy('batch');setError('');
  try{const csrf=await getCsrfToken();await classroomClient.endBatch(session.id,session.activeBatchId,csrf);setSession(x=>x?{...x,activeBatchId:'',activeQuestionOrdinal:null}:x);setPresentation(null);setCompetition(null);setNotice('تم إنهاء الدفعة. يمكنك اختيار أسئلة وإضافة الدفعة التالية.')}
  catch(e){setError(e instanceof Error?e.message:'تعذر إنهاء الدفعة')}finally{setBusy('')}
 }
 async function appendBatch(){
  if(!session||selected.length===0)return;setBusy('append');setError('');
  try{const csrf=await getCsrfToken();const out=await classroomClient.appendBatch(session.id,'دفعة جديدة',selected,csrf);setSelected([]);setNotice('تمت إضافة الدفعة.');if(out.batch.questions[0])await publish(out.batch.questions[0].ordinal)}
  catch(e){setError(e instanceof Error?e.message:'تعذر إضافة الدفعة')}finally{setBusy('')}
 }
 async function endSession(){
  if(!session)return;setBusy('end');setError('');
  try{const csrf=await getCsrfToken();const out=await classroomClient.end(session.id,csrf);setReport(out.report);setSession(x=>x?{...x,status:'ended',activeBatchId:'',activeQuestionOrdinal:null}:x);setPresentation(null);setCompetition(null);setNotice('انتهت الحصة وحُفظ التقرير النهائي غير القابل للتعديل.')}
  catch(e){setError(e instanceof Error?e.message:'تعذر إنهاء الحصة')}finally{setBusy('')}
 }

 if(authLoading||busy==='load')return <main dir="rtl" className="p-10 text-center font-black"><Loader2 className="mx-auto mb-2 animate-spin"/>جاري تحميل الفصل الذكي...</main>;
 if(!user||(!user.roles.includes('teacher')&&!user.roles.includes('admin')))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">الفصل الذكي متاح للمعلم المخول.</main>;
 if(workspace&&!workspace.personas.schoolTeacher&&!user.roles.includes('admin'))return <main dir="rtl" className="p-10 text-center font-black text-amber-700">لا توجد مهمة تدريس مدرسية فعالة لهذا الحساب.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-7xl space-y-4">
  <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-cyan-300"><Radio size={18}/><span className="text-xs font-black">SMART CLASSROOM / REALTIME</span></div><h1 className="mt-2 text-2xl font-black sm:text-3xl">الفصل الذكي</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">أسئلة مثبتة من بنك الأسئلة، حضور مرتبط بالـRoster، إجابات قابلة للمراجعة قبل كشف الحل، وتحديات زمنية حتمية بلا نقاط سرعة أو تسريب لمفتاح الإجابة.</p></div><div className="flex flex-wrap gap-2">{session?.id?<Link to={'/classroom/'+session.id+'/projector'} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-900"><Presentation size={17}/>فتح شاشة العرض</Link>:null}<button type="button" onClick={()=>void loadWorkspace()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-black"><RefreshCcw size={16}/>تحديث</button></div></div></header>
  {error?<div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}{notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}

  <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
   <aside className="space-y-4">
    <div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="font-black">نطاق التدريس</h2><div className="mt-3 space-y-2">{workspace?.schools.flatMap(s=>s.assignments.map(a=><button key={a.assignmentId} type="button" onClick={()=>chooseScope(s,a)} className={'w-full rounded-2xl border p-3 text-right '+(scope?.assignment.assignmentId===a.assignmentId?'border-indigo-500 bg-indigo-50':'bg-white')}><div className="font-black">{s.schoolName} · {a.className}</div><div className="mt-1 text-xs font-bold text-gray-500">{subjectNames[a.subjectId]||a.subjectId} · {a.studentCount} طالب</div></button>))}</div></div>
    {session?<div className="rounded-3xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-black">الحصة الحالية</h2><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">{session.status}</span></div>{pin?<div className="mt-4 grid place-items-center gap-3 rounded-2xl bg-slate-950 p-4 text-center text-white"><ClassroomJoinQR pin={pin} size={132}/><div><div className="text-xs font-bold text-slate-400">PIN بديل للـQR</div><div className="mt-1 text-4xl font-black tracking-[.25em]" dir="ltr">{pin}</div></div></div>:<div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">PIN لا يُخزن كنص صريح على الخادم؛ عند استعادة جلسة قديمة يبقى الانضمام من رابط/رمز محفوظ لدى المعلم فقط.</div>}<div className="mt-3 grid gap-2">{session.status==='draft'?<button type="button" onClick={()=>void start()} disabled={busy!==''} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white"><Play size={17}/>بدء الحصة</button>:null}{session.status==='live'&&session.activeQuestionOrdinal===null?<button type="button" onClick={()=>void publish(0)} disabled={busy!==''} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-black text-white"><Send size={17}/>نشر السؤال الأول</button>:null}{session.status==='live'&&session.activeQuestionOrdinal!==null?<button type="button" onClick={()=>void reveal()} disabled={busy!==''||Boolean(activeQuestion?.revealed)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-black text-white disabled:opacity-40"><CheckCircle2 size={17}/>إظهار الحل</button>:null}{session.status==='live'&&session.activeBatchId?<button type="button" onClick={()=>void endBatch()} disabled={busy!==''} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-black"><Square size={16}/>إنهاء الدفعة</button>:null}{session.status==='live'?<button type="button" onClick={()=>void endSession()} disabled={busy!==''} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 font-black text-white"><Square size={16}/>إنهاء الحصة وحفظ التقرير</button>:null}</div></div>:null}
   </aside>

   <div className="space-y-4">
    {session?.status==='live'&&activeQuestion?<section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black text-indigo-600">السؤال المباشر #{activeQuestion.ordinal+1}</div><h2 className="mt-2 text-xl font-black">{activeQuestion.text||'سؤال بصري'}</h2></div><div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><div className="text-2xl font-black">{activeAggregate?.responseCount||0}</div><div className="text-xs font-bold text-gray-500">إجابة · {presentation?.aggregate.joinedCount||0} منضم</div></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{activeQuestion.options.map(o=><div key={o.index} className={'rounded-2xl border p-3 font-bold '+(activeQuestion.revealed&&activeQuestion.correctOptionIndex===o.index?'border-emerald-500 bg-emerald-50':'bg-white')}><div className="flex items-center justify-between gap-3"><span>{o.text||'الخيار '+(o.index+1)}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{activeAggregate?.distribution[String(o.index)]||0}</span></div></div>)}</div>{activeQuestion.revealed&&activeQuestion.explanation?<div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-800">{activeQuestion.explanation}</div>:null}</section>:null}

    {session?.status==='live'&&attendance?<section data-testid="classroom-attendance" className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><UserCheck className="text-emerald-600" size={19}/><h2 className="text-lg font-black">الحضور الذكي</h2></div><p className="mt-1 text-xs font-bold text-gray-500">الانضمام قبل أول نشر = حاضر؛ بعد أول نشر = متأخر. يمكن للمعلم تصحيح الحالة، حتى لطالب لم ينضم بعد.</p></div><div className="flex gap-2 text-xs font-black"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">حاضر {attendance.present}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">متأخر {attendance.late}</span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">غائب {attendance.absent}</span><span className="rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">بعذر {attendance.excused}</span></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{attendance.rows.map(row=>{const student=rosterById.get(row.studentId);return <div key={row.studentId} className="flex items-center justify-between gap-3 rounded-2xl border p-3"><div className="min-w-0"><div className="truncate font-black">{student?.name||row.studentId}</div><div className="mt-1 text-[11px] font-bold text-gray-400">{row.joinedAt?'انضم '+new Date(row.joinedAt).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}):'لم ينضم'}{row.joinedMethod?' · '+row.joinedMethod:''}</div></div><select aria-label={'حضور '+(student?.name||row.studentId)} value={row.attendanceStatus} disabled={busy==='attendance:'+row.studentId} onChange={e=>void changeAttendance(row.studentId,e.target.value as ClassroomAttendanceStatus)} className="rounded-xl border p-2 text-xs font-black">{Object.entries(attendanceLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>})}</div></section>:null}

    {session?.status==='live'&&session.activeBatchId?<section data-testid="classroom-challenge" className="rounded-3xl border border-violet-100 bg-violet-50 p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-violet-700"><Trophy size={19}/><h2 className="text-lg font-black">تحدي الدفعة</h2></div><p className="mt-1 text-xs font-bold leading-6 text-violet-700">100 نقطة لكل إجابة صحيحة، بلا نقاط سرعة. الخادم يغلق نافذة الإجابة عند انتهاء المؤقت.</p></div>{challenge?.competitionEnabled?<div className="rounded-2xl bg-white px-5 py-3 text-center shadow-sm"><div className="text-3xl font-black text-violet-900">{challengeRemaining}</div><div className="text-[10px] font-black text-violet-500">ثانية متبقية</div></div>:null}</div>{!challenge?.competitionEnabled?<div className="mt-4 flex flex-wrap gap-2"><select aria-label="مدة تحدي الفصل" value={challengeDuration} onChange={e=>setChallengeDuration(Number(e.target.value))} className="rounded-xl border bg-white p-2.5 font-black"><option value={30}>30 ثانية</option><option value={60}>60 ثانية</option><option value={90}>90 ثانية</option><option value={120}>120 ثانية</option></select><button type="button" onClick={()=>void startChallenge()} disabled={busy!==''} className="rounded-xl bg-violet-700 px-4 py-2.5 font-black text-white"><Clock3 size={16} className="ml-2 inline"/>بدء التحدي</button></div>:<button type="button" onClick={()=>void stopChallenge()} disabled={busy!==''||challenge.expired} className="mt-4 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-black text-violet-800 disabled:opacity-40">إنهاء التحدي الآن</button>}{competition?.leaderboard.length?<div className="mt-4 grid gap-2 sm:grid-cols-3">{competition.leaderboard.slice(0,3).map(row=><div key={row.studentId} className="rounded-2xl bg-white p-4 text-center shadow-sm"><div className="text-xs font-black text-violet-500">#{row.rank}</div><div className="mt-1 truncate font-black">{rosterById.get(row.studentId)?.name||row.studentId}</div><div className="mt-2 text-2xl font-black text-violet-900">{row.score}</div><div className="text-[11px] font-bold text-gray-500">{row.correct}/{row.answered} · {row.accuracy}%</div></div>)}</div>:null}</section>:null}

    {report?<section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BarChart3 className="text-indigo-600"/><h2 className="text-xl font-black">التقرير النهائي</h2></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><Stat label="المنضمون" value={report.roster.joined}/><Stat label="حاضر" value={report.roster.present}/><Stat label="متأخر" value={report.roster.late}/><Stat label="بعذر" value={report.roster.excused}/><Stat label="الإجابات" value={report.totals.responses}/></div><p className="mt-4 text-xs font-bold text-gray-500">هذا Snapshot نهائي محفوظ في PostgreSQL ويحتفظ بحقيقة الحضور وطرق الانضمام ولا يعتمد على حالة المتصفح أو Redis.</p></section>:null}

    {scope&&(!session||session.status==='draft'||(session.status==='live'&&!session.activeBatchId))?<section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black">{session?.status==='live'?'أسئلة الدفعة التالية':'بناء الحصة'}</h2><p className="mt-1 text-xs font-bold text-gray-500">اختر حتى 30 سؤالًا معتمدًا من المادة المعيّنة.</p></div><div className="relative w-full sm:w-80"><Search className="absolute right-3 top-3 text-gray-400" size={17}/><input aria-label="بحث أسئلة الفصل الذكي" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border py-2.5 pl-3 pr-9" placeholder="بحث في السؤال أو الكود"/></div></div><div className="mt-4 max-h-[430px] space-y-2 overflow-auto">{questions.map(q=><button key={q.id} type="button" onClick={()=>toggle(q.id)} className={'w-full rounded-2xl border p-3 text-right '+(selected.includes(q.id)?'border-indigo-500 bg-indigo-50':'bg-white')}><div className="flex items-start justify-between gap-3"><div className="font-bold leading-7">{q.text||'سؤال بصري'}</div><span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-black">v{q.version}</span></div><div className="mt-1 text-[11px] font-bold text-gray-400">{q.questionType} · {q.difficulty||'—'}</div></button>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-black text-gray-500">تم اختيار {selected.length}</span>{!session?<div className="flex items-center gap-2"><select aria-label="نمط نشر الفصل الذكي" value={mode} onChange={e=>setMode(e.target.value as ClassroomPublishedMode)} className="rounded-xl border p-2.5 font-bold"><option value="single">سؤال واحد</option><option value="batch">دفعة كاملة</option></select><button type="button" onClick={()=>void create()} disabled={!selected.length||busy!==''} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 font-black text-white disabled:opacity-40"><ChevronLeft size={17}/>إنشاء الحصة</button></div>:session.status==='live'?<button type="button" onClick={()=>void appendBatch()} disabled={!selected.length||busy!==''} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-black text-white disabled:opacity-40"><Send size={17}/>إضافة ونشر الدفعة</button>:null}</div></section>:null}
   </div>
  </section>
 </div></main>;
}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-slate-50 p-4 text-center"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-xs font-bold text-gray-500">{label}</div></div>}
