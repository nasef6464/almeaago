import { Building2, GraduationCap, Loader2, Pencil, Plus, Power, Search, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  organizationsClient,
  type DirectorAssignment,
  type DirectorStudent,
  type DirectorTeacher,
  type SchoolClass,
  type SchoolContext,
} from '../api/organizations-client';

const CORE='SCHOOL_CORE';

export function SchoolDirectorDashboardPage(){
  const {user,loading:authLoading,getCsrfToken}=useAuth();
  const [schools,setSchools]=useState<SchoolContext[]>([]);
  const [schoolId,setSchoolId]=useState('');
  const [classes,setClasses]=useState<SchoolClass[]>([]);
  const [students,setStudents]=useState<DirectorStudent[]>([]);
  const [studentTotal,setStudentTotal]=useState(0);
  const [teachers,setTeachers]=useState<DirectorTeacher[]>([]);
  const [assignments,setAssignments]=useState<DirectorAssignment[]>([]);
  const [search,setSearch]=useState('');
  const [busy,setBusy]=useState(true);
  const [pending,setPending]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showAdd,setShowAdd]=useState(false);
  const [draft,setDraft]=useState({name:'',email:'',password:'',classId:''});
  const [editing,setEditing]=useState({studentId:'',name:'',phone:''});
  const [newClassName,setNewClassName]=useState('');
  const [rename,setRename]=useState({classId:'',name:''});
  const [assignment,setAssignment]=useState({teacherId:'',classId:'',subjectId:'',status:'active' as 'active'|'inactive'});

  const selectedSchool=useMemo(()=>schools.find(x=>x.schoolId===schoolId)||schools[0], [schoolId,schools]);
  const has=(p:string)=>Boolean(selectedSchool?.permissions.includes(p));
  const hasCore=Boolean(selectedSchool?.modules.includes(CORE));
  const canOptional=(p:string)=>has(p)&&hasCore;

  useEffect(()=>{
    if(authLoading||!user)return;
    const c=new AbortController();
    setBusy(true);setError('');
    organizationsClient.contexts(c.signal).then(r=>{
      const director=r.contexts.filter(x=>x.role==='school_admin');
      setSchools(director);
      setSchoolId(x=>director.some(s=>s.schoolId===x)?x:(director[0]?.schoolId||''));
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل مساحة مدير المدرسة')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,user]);

  async function refresh(query=search){
    if(!selectedSchool)return;
    setBusy(true);setError('');
    try{
      const [classResult,studentResult,teacherResult]=await Promise.all([
        organizationsClient.classes(selectedSchool.schoolId),
        has('SCHOOL_STUDENTS_VIEW')?organizationsClient.directorStudents(selectedSchool.schoolId,query):Promise.resolve({students:[],total:0}),
        canOptional('SCHOOL_TEACHERS_ASSIGN')?organizationsClient.directorTeachers(selectedSchool.schoolId):Promise.resolve({teachers:[],assignments:[]}),
      ]);
      setClasses(classResult.classes);
      setStudents(studentResult.students);
      setStudentTotal(studentResult.total);
      setTeachers(teacherResult.teachers);
      setAssignments(teacherResult.assignments);
      setDraft(x=>({...x,classId:classResult.classes.some(v=>v.id===x.classId)?x.classId:(classResult.classes[0]?.id||'')}));
      setAssignment(x=>({...x,classId:classResult.classes.some(v=>v.id===x.classId)?x.classId:(classResult.classes[0]?.id||'')}));
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحديث المدرسة')}
    finally{setBusy(false)}
  }

  useEffect(()=>{
    if(!selectedSchool)return;
    setSearch('');setNotice('');setError('');
    void refresh('');
  },[selectedSchool?.schoolId]);

  async function run(key:string, action:(csrf:string)=>Promise<void>, success:string){
    setPending(key);setError('');setNotice('');
    try{const csrf=await getCsrfToken();await action(csrf);if(success)setNotice(success)}
    catch(e){setError(e instanceof Error?e.message:'تعذر تنفيذ العملية')}
    finally{setPending('')}
  }

  async function addStudent(){
    if(!selectedSchool||!draft.classId)return;
    await run('add',async csrf=>{
      const result=await organizationsClient.addDirectorStudent(selectedSchool.schoolId,draft,csrf);
      setShowAdd(false);setDraft({name:'',email:'',password:'',classId:classes[0]?.id||''});
      await refresh(search);
      setNotice(result.created?'تم إنشاء الطالب وربطه بالمدرسة والفصل.':'الطالب موجود وتم تأكيد ربطه بالفصل المحدد.');
    },'');
  }

  async function moveStudent(studentId:string,classId:string){
    if(!selectedSchool||!classId)return;
    await run(studentId,async csrf=>{
      const result=await organizationsClient.moveDirectorStudent(selectedSchool.schoolId,studentId,classId,csrf);
      setStudents(x=>x.map(s=>s.studentId===studentId?result.student:s));
      setNotice(result.idempotent?'الطالب موجود بالفعل في هذا الفصل؛ لم تتكرر أي عضوية.':'تم نقل الطالب داخل المدرسة وحفظ الفصل الجديد.');
    },'');
  }

  async function saveStudent(){
    if(!selectedSchool||!editing.studentId)return;
    await run('edit-'+editing.studentId,async csrf=>{
      const r=await organizationsClient.updateDirectorStudent(selectedSchool.schoolId,editing.studentId,{name:editing.name,phone:editing.phone},csrf);
      setStudents(x=>x.map(s=>s.studentId===editing.studentId?r.student:s));
      setEditing({studentId:'',name:'',phone:''});
    },'تم تحديث بيانات الطالب الأساسية.');
  }

  async function toggleStudent(student:DirectorStudent){
    if(!selectedSchool)return;
    await run('active-'+student.studentId,async csrf=>{
      const r=await organizationsClient.setDirectorStudentActive(selectedSchool.schoolId,student.studentId,!student.isActive,csrf);
      setStudents(x=>x.map(s=>s.studentId===student.studentId?r.student:s));
    },student.isActive?'تم تعطيل الطالب بصورة قابلة للاسترجاع.':'تمت إعادة تفعيل الطالب.');
  }

  async function createClass(){
    if(!selectedSchool||!newClassName.trim())return;
    await run('class',async csrf=>{await organizationsClient.createDirectorClass(selectedSchool.schoolId,newClassName.trim(),csrf);setNewClassName('');await refresh(search)},'تم إنشاء الفصل داخل المدرسة.');
  }

  async function renameClass(){
    if(!selectedSchool||!rename.classId||!rename.name.trim())return;
    await run('rename-'+rename.classId,async csrf=>{await organizationsClient.renameDirectorClass(selectedSchool.schoolId,rename.classId,rename.name.trim(),csrf);setRename({classId:'',name:''});await refresh(search)},'تم تحديث اسم الفصل.');
  }

  async function saveAssignment(){
    if(!selectedSchool||!assignment.teacherId||!assignment.classId)return;
    await run('assignment',async csrf=>{await organizationsClient.upsertDirectorAssignment(selectedSchool.schoolId,assignment,csrf);const r=await organizationsClient.directorTeachers(selectedSchool.schoolId);setTeachers(r.teachers);setAssignments(r.assignments)},'تم حفظ تكليف المعلم.');
  }

  if(authLoading||busy&&schools.length===0)return <main dir="rtl" className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={38}/></main>;
  if(!user?.roles.includes('school_admin'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه المساحة مخصصة لمدير المدرسة.</main>;
  if(!selectedSchool)return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 p-6"><div className="mx-auto mt-20 max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><ShieldCheck className="mx-auto text-slate-400" size={40}/><h1 className="mt-4 text-xl font-black">لا توجد مدرسة مفوضة</h1><p className="mt-2 text-sm text-slate-500">اطلب من مدير المنصة ربط حسابك بمدرسة وتفعيل الصلاحيات المطلوبة.</p></div></main>;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 text-slate-900 sm:px-8" data-testid="school-director-dashboard"><div className="mx-auto max-w-7xl">
    <header className="rounded-3xl bg-gradient-to-l from-indigo-700 via-indigo-800 to-slate-900 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-bold text-indigo-200"><ShieldCheck size={17}/> نطاق مفوض من مدير المنصة</p><h1 className="mt-2 text-3xl font-black">لوحة مدير المدرسة</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-indigo-100">رؤية تشغيلية وعمليات طلاب وفصول ومعلمين داخل المدارس المصرح بها فقط.</p></div><label className="text-sm font-bold">المدرسة<select aria-label="المدرسة" value={selectedSchool.schoolId} onChange={e=>setSchoolId(e.target.value)} className="mt-2 block w-full min-w-56 rounded-xl border-0 bg-white px-4 py-3 text-slate-900">{schools.map(s=><option key={s.schoolId} value={s.schoolId}>{s.schoolName}</option>)}</select></label></div></header>

    {error?<div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>:null}
    {notice?<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>:null}

    {has('SCHOOL_OVERVIEW_VIEW')?<section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article className="rounded-2xl border bg-white p-4 shadow-sm"><Users className="text-indigo-700" size={20}/><p className="mt-3 text-xs font-bold text-slate-500">الطلاب</p><p className="text-2xl font-black">{has('SCHOOL_STUDENTS_VIEW')?studentTotal:'—'}</p></article>
      <article className="rounded-2xl border bg-white p-4 shadow-sm"><Building2 className="text-sky-700" size={20}/><p className="mt-3 text-xs font-bold text-slate-500">الفصول</p><p className="text-2xl font-black">{classes.length}</p></article>
      <article className="rounded-2xl border bg-white p-4 shadow-sm"><GraduationCap className="text-amber-700" size={20}/><p className="mt-3 text-xs font-bold text-slate-500">المعلمون المتاحون للتكليف</p><p className="text-2xl font-black">{canOptional('SCHOOL_TEACHERS_ASSIGN')?teachers.length:'—'}</p></article>
      <article className="rounded-2xl border bg-white p-4 shadow-sm"><ShieldCheck className="text-violet-700" size={20}/><p className="mt-3 text-xs font-bold text-slate-500">الصلاحيات المفوضة</p><p className="text-2xl font-black">{selectedSchool.permissions.length}</p></article>
    </section>:null}

    <section className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black text-indigo-600">تشغيل الطلاب</p><h2 className="mt-1 text-xl font-black">طلاب {selectedSchool.schoolName}</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute right-3 top-2.5 text-slate-400" size={17}/><input aria-label="بحث الطلاب" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void refresh(search)}} placeholder="ابحث بالاسم أو البريد" className="w-full rounded-xl border py-2 pr-9 pl-3 text-sm"/></div>{has('SCHOOL_STUDENTS_ADD')?<button type="button" onClick={()=>setShowAdd(x=>!x)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white"><Plus size={17}/> إضافة طالب</button>:null}</div></div>

      {showAdd?<div className="mt-5 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:grid-cols-2 xl:grid-cols-5"><input aria-label="اسم الطالب الجديد" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="اسم الطالب" className="rounded-xl border px-3 py-2 text-sm"/><input aria-label="بريد الطالب الجديد" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="البريد الإلكتروني" className="rounded-xl border px-3 py-2 text-sm"/><input aria-label="كلمة مرور الطالب الجديد" type="password" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})} placeholder="كلمة مرور مؤقتة" className="rounded-xl border px-3 py-2 text-sm"/><select aria-label="فصل الطالب الجديد" value={draft.classId} onChange={e=>setDraft({...draft,classId:e.target.value})} className="rounded-xl border px-3 py-2 text-sm"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" disabled={pending==='add'} onClick={()=>void addStudent()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50">إنشاء وربط</button></div>:null}

      {!has('SCHOOL_STUDENTS_VIEW')?<div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">صلاحية عرض الطلاب غير مفعلة لهذا الربط.</div>:students.length===0&&!busy?<div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">لا يوجد طلاب مطابقون حاليًا.</div>:<><div className="mt-5 space-y-3 lg:hidden">{students.map(student=>editing.studentId===student.studentId?<article key={student.studentId} className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="grid gap-2 sm:grid-cols-2"><input aria-label="تعديل اسم الطالب" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} className="rounded-xl border bg-white px-3 py-2"/><input aria-label="تعديل جوال الطالب" value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})} className="rounded-xl border bg-white px-3 py-2" placeholder="رقم الجوال"/></div><p className="mt-2 text-xs font-bold text-slate-500">تعديل بيانات أساسية فقط؛ لا تغيير للبريد أو الدور.</p><div className="mt-3 flex gap-2"><button type="button" onClick={()=>void saveStudent()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white">حفظ</button><button type="button" onClick={()=>setEditing({studentId:'',name:'',phone:''})} className="rounded-xl border bg-white px-4 py-2 text-xs font-black text-slate-600">إلغاء</button></div></article>:<article key={student.studentId} className="rounded-2xl border bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate">{student.name}</b><div className="mt-1 break-all text-xs font-bold text-slate-500">{student.email}{student.phone?` · ${student.phone}`:''}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${student.isActive?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{student.isActive?'نشط':'موقوف'}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">{has('SCHOOL_STUDENTS_MOVE_CLASS')?<select aria-label={`اختيار صف بطاقة ${student.name}`} value={student.classId||''} disabled={pending===student.studentId} onChange={e=>void moveStudent(student.studentId,e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">بدون فصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:<div className="rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-slate-200">{student.className||'بدون فصل'}</div>}<div className="flex gap-2">{canOptional('SCHOOL_STUDENTS_UPDATE_BASIC')?<button aria-label={`فتح تعديل بطاقة ${student.name}`} type="button" onClick={()=>setEditing({studentId:student.studentId,name:student.name,phone:student.phone||''})} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-indigo-700"><Pencil size={15}/></button>:null}{canOptional('SCHOOL_STUDENTS_DEACTIVATE')?<button aria-label={`تغيير حالة بطاقة ${student.name}`} type="button" onClick={()=>void toggleStudent(student)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white"><Power size={15}/></button>:null}</div></div></article>)}</div><div className="mt-5 hidden overflow-x-auto lg:block"><table className="w-full min-w-[820px] text-right text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">الطالب</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">الفصل</th><th className="px-4 py-3">عمليات مفوضة</th></tr></thead><tbody className="divide-y">{students.map(student=><tr key={student.studentId}>{editing.studentId===student.studentId?<><td className="px-4 py-3"><input aria-label="تعديل اسم الطالب" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} className="block rounded-lg border px-2 py-1"/><input aria-label="تعديل جوال الطالب" value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})} className="mt-1 block rounded-lg border px-2 py-1" placeholder="رقم الجوال"/></td><td className="px-4 py-3" colSpan={2}>تعديل بيانات أساسية فقط؛ لا تغيير للبريد أو الدور.</td><td className="px-4 py-3"><button type="button" onClick={()=>void saveStudent()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white">حفظ</button><button type="button" onClick={()=>setEditing({studentId:'',name:'',phone:''})} className="mr-2 text-xs font-bold text-slate-500">إلغاء</button></td></>:<><td className="px-4 py-3"><b className="block">{student.name}</b><span className="text-xs text-slate-500">{student.email}{student.phone?` · ${student.phone}`:''}</span></td><td className="px-4 py-3">{student.isActive?'نشط':'موقوف'}</td><td className="px-4 py-3">{has('SCHOOL_STUDENTS_MOVE_CLASS')?<select aria-label={`فصل ${student.name}`} value={student.classId||''} disabled={pending===student.studentId} onChange={e=>void moveStudent(student.studentId,e.target.value)} className="rounded-xl border px-3 py-2"><option value="">بدون فصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:<span>{student.className||'بدون فصل'}</span>}</td><td className="px-4 py-3"><div className="flex gap-2">{canOptional('SCHOOL_STUDENTS_UPDATE_BASIC')?<button aria-label={`تعديل ${student.name}`} type="button" onClick={()=>setEditing({studentId:student.studentId,name:student.name,phone:student.phone||''})} className="rounded-lg border p-2 text-indigo-700"><Pencil size={15}/></button>:null}{canOptional('SCHOOL_STUDENTS_DEACTIVATE')?<button aria-label={student.isActive?`تعطيل ${student.name}`:`تفعيل ${student.name}`} type="button" onClick={()=>void toggleStudent(student)} className="rounded-lg border p-2"><Power size={15}/></button>:null}</div></td></>}</tr>)}</tbody></table></div></>}
    </section>

    {canOptional('SCHOOL_CLASSES_MANAGE')||canOptional('SCHOOL_TEACHERS_ASSIGN')?<section className="mt-7 grid gap-4 lg:grid-cols-2">
      {canOptional('SCHOOL_CLASSES_MANAGE')?<article className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">إدارة الفصول</h2><div className="mt-3 flex gap-2"><input aria-label="اسم فصل جديد" value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="اسم فصل جديد" className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button aria-label="إنشاء الفصل" type="button" onClick={()=>void createClass()} className="rounded-xl bg-sky-700 px-3 text-white"><Plus size={17}/></button></div><div className="mt-3 space-y-2">{classes.map(c=>rename.classId===c.id?<div key={c.id} className="flex gap-2"><input aria-label="اسم الفصل المعدل" value={rename.name} onChange={e=>setRename({...rename,name:e.target.value})} className="flex-1 rounded-lg border px-2"/><button type="button" onClick={()=>void renameClass()} className="font-black text-sky-700">حفظ</button></div>:<div key={c.id} className="flex items-center rounded-xl bg-slate-50 px-3 py-2"><span className="flex-1 font-bold">{c.name}</span><button type="button" aria-label={`تعديل ${c.name}`} onClick={()=>setRename({classId:c.id,name:c.name})}><Pencil size={15}/></button></div>)}</div></article>:null}
      {canOptional('SCHOOL_TEACHERS_ASSIGN')?<article className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">تكليف المعلمين</h2><div className="mt-3 grid gap-2"><select aria-label="المعلم" value={assignment.teacherId} onChange={e=>setAssignment({...assignment,teacherId:e.target.value})} className="rounded-xl border px-3 py-2"><option value="">اختر المعلم</option>{teachers.map(t=><option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}</select><select aria-label="فصل التكليف" value={assignment.classId} onChange={e=>setAssignment({...assignment,classId:e.target.value})} className="rounded-xl border px-3 py-2"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input aria-label="معرف مادة التكليف" value={assignment.subjectId} onChange={e=>setAssignment({...assignment,subjectId:e.target.value})} placeholder="معرّف المادة (اختياري)" className="rounded-xl border px-3 py-2"/><button type="button" disabled={!assignment.teacherId||!assignment.classId} onClick={()=>void saveAssignment()} className="rounded-xl bg-emerald-700 py-2 font-black text-white disabled:opacity-40">حفظ التكليف</button></div><p className="mt-3 text-xs text-slate-500">التكليفات الفعالة: {assignments.filter(a=>a.status==='active').length}</p></article>:null}
    </section>:null}

    <div className="mt-7 flex flex-wrap gap-2 text-sm font-bold"><Link to="/school-director-dashboard/interventions" className="rounded-xl border bg-white px-4 py-2">التدخلات والخطط العلاجية</Link><Link to="/reports" className="rounded-xl border bg-white px-4 py-2">التقارير</Link></div>
  </div></main>;
}
