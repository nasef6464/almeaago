import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Filter,
  GraduationCap,
  LayoutGrid,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyPath, TaxonomySubject } from '../../content/api/content-types';
import { DirectorAssessmentCreator } from '../components/DirectorAssessmentCreator';
import { DirectorAssessmentReportPanel } from '../components/DirectorAssessmentReportPanel';
import { DirectorTeacherAssignments } from '../components/DirectorTeacherAssignments';
import { SupervisorTestsManager } from '../components/SupervisorTestsManager';
import { SchoolDirectorBreadcrumb, SchoolDirectorSectionNav, directorNavItems, type DirectorSectionID } from '../components/SchoolDirectorSectionNav';
import {
  organizationsClient,
  type DirectorAssignment,
  type DirectorAssessment,
  type DirectorOverview,
  type DirectorAssessmentWorkspace,
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
  const [overview,setOverview]=useState<DirectorOverview|null>(null);
  const [overviewLoading,setOverviewLoading]=useState(false);
  const [overviewError,setOverviewError]=useState('');
  const [overviewReload,setOverviewReload]=useState(0);
  const [assessmentWorkspace,setAssessmentWorkspace]=useState<DirectorAssessmentWorkspace|null>(null);
  const [assessmentLoading,setAssessmentLoading]=useState(false);
  const [assessmentError,setAssessmentError]=useState('');
  const [assessmentReload,setAssessmentReload]=useState(0);
  const [showAssessmentCreator,setShowAssessmentCreator]=useState(false);
  const [selectedAssessment,setSelectedAssessment]=useState<{schoolId:string;assessment:DirectorAssessment}|null>(null);
  const [activeSection,setActiveSection]=useState<DirectorSectionID>('overview');
  const [subjects,setSubjects]=useState<TaxonomySubject[]>([]);
  const [paths,setPaths]=useState<TaxonomyPath[]>([]);
  const [subjectsError,setSubjectsError]=useState(false);
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

  // Transfer Student Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferStudent, setTransferStudent] = useState<DirectorStudent | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState('');

  // Skills Radar States for School Director
  const [skillLevelFilter, setSkillLevelFilter] = useState<'all' | 'critical' | 'watch' | 'mastered'>('all');
  const [skillPathFilter, setSkillPathFilter] = useState('all');
  const [skillSubjectFilter, setSkillSubjectFilter] = useState('all');
  const [skillClassFilter, setSkillClassFilter] = useState('all');
  const [skillGradeFilter, setSkillGradeFilter] = useState('all');
  const [skillStudentFilter, setSkillStudentFilter] = useState('all');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [skillsViewMode, setSkillsViewMode] = useState<'cards' | 'matrix'>('cards');
  const [activeSkillForDrawer, setActiveSkillForDrawer] = useState<any | null>(null);
  const [remedialFeedback, setRemedialFeedback] = useState('');

  // Smart Classroom Live & Completed Sessions
  const [smartSessions] = useState([
    {
      id: '01a1c5d4-ecb7-73e5-8184-eb07274aef81',
      className: 'الصف الثالث الثانوي (أ)',
      subjectName: 'القدرات العامة - القسم الكمي',
      teacherName: 'أ. فهد القحطاني',
      pin: '605542',
      status: 'completed',
      activeParticipants: 1,
      finalizedAt: 'اليوم · 05:20 م',
      mode: 'single',
    },
    {
      id: '01a1c5d2-5a09-7228-8510-86cb4e28e35f',
      className: 'الصف الثالث الثانوي (ب)',
      subjectName: 'التحصيلي العلمي - فيزياء',
      teacherName: 'أ. فهد القحطاني',
      pin: '678683',
      status: 'completed',
      activeParticipants: 1,
      finalizedAt: 'اليوم · 05:18 م',
      mode: 'single',
    },
  ]);

  // School-wide Skills List
  const [directorSkills] = useState([
    {
      id: 'sk-1',
      skill: 'المتتابعات الحسابية والهندسية',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 54,
      attempts: 24,
      atRiskStudents: [
        { id: '018f0000-0000-7000-8000-000000000005', name: 'فيصل بن سعد', score: 52, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
        { id: 'st-5', name: 'عمر القحطاني', score: 48, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
        { id: 'st-6', name: 'عبدالله الشهري', score: 55, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
      ],
    },
    {
      id: 'sk-2',
      skill: 'الكسور والعمليات الحسابية السريعة',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 62,
      attempts: 30,
      atRiskStudents: [
        { id: 'st-3', name: 'محمد الدوسري', score: 50, status: 'حرجة', class: 'الصف الثالث الثانوي (ب)' },
        { id: 'st-7', name: 'ياسر الحربي', score: 64, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
    {
      id: 'sk-3',
      skill: 'التناسب الطردي والعكسي وتطبيقات النسبة',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 86,
      attempts: 42,
      atRiskStudents: [],
    },
    {
      id: 'sk-4',
      skill: 'استيعاب المقروء وتحليل النصوص الفلسفية والبيئية',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات اللفظي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 78,
      attempts: 38,
      atRiskStudents: [
        { id: 'st-8', name: 'خالد المطيري', score: 58, status: 'حرجة', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
    {
      id: 'sk-5',
      skill: 'قوانين نيوتن وحسابات القوة والتسارع',
      pathId: 'tahsili',
      pathName: 'التحصيلي العلمي',
      subjectName: 'التحصيلي - فيزياء',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 59,
      attempts: 26,
      atRiskStudents: [
        { id: '018f0000-0000-7000-8000-000000000005', name: 'فيصل بن سعد', score: 56, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
      ],
    },
    {
      id: 'sk-6',
      skill: 'الكيمياء الكهربية وتفاعلات الأكسدة والاختزال',
      pathId: 'tahsili',
      pathName: 'التحصيلي العلمي',
      subjectName: 'التحصيلي - كيمياء',
      gradeName: 'الصف الثاني الثانوي',
      classId: '018f0000-0000-7000-9100-000000000003',
      className: 'الصف الثاني الثانوي (أ)',
      mastery: 91,
      attempts: 34,
      atRiskStudents: [],
    },
  ]);

  const loadEpoch=useRef(0);
  const activeSchoolId=useRef('');
  const teacherReadVersion=useRef(0);
  const schoolVisitEpoch=useRef(0);
  const overviewReadEpoch=useRef(0);
  const assessmentReadEpoch=useRef(0);

  const selectedSchool=useMemo(()=>schools.find(x=>x.schoolId===schoolId), [schoolId,schools]);
  const has=(p:string)=>Boolean(selectedSchool?.permissions.includes(p));
  const hasCore=Boolean(selectedSchool?.modules.includes(CORE));
  const canOptional=(p:string)=>has(p)&&hasCore;
  const navItems=useMemo(()=>selectedSchool?directorNavItems(selectedSchool):[],[selectedSchool]);
  const section=navItems.some(item=>item.id===activeSection)?activeSection:(navItems[0]?.id||'overview');

  useEffect(()=>{
    const controller=new AbortController();
    const epoch=++assessmentReadEpoch.current;
    const requestedSchool=selectedSchool?.schoolId;
    const visit=schoolVisitEpoch.current;
    setAssessmentWorkspace(null);setAssessmentError('');setAssessmentLoading(false);
    if(section!=='assessments'||!requestedSchool||
      !selectedSchool?.permissions.includes('SCHOOL_ASSESSMENTS_MANAGE')||
      !selectedSchool?.modules.includes('SCHOOL_ASSESSMENTS'))return ()=>controller.abort();
    setAssessmentLoading(true);
    organizationsClient.directorAssessments(requestedSchool,controller.signal).then(result=>{
      if(controller.signal.aborted||epoch!==assessmentReadEpoch.current||
        activeSchoolId.current!==requestedSchool||visit!==schoolVisitEpoch.current)return;
      setAssessmentWorkspace(result);
    }).catch(e=>{
      if(controller.signal.aborted||epoch!==assessmentReadEpoch.current||
        activeSchoolId.current!==requestedSchool||visit!==schoolVisitEpoch.current)return;
      setAssessmentError(e instanceof Error?e.message:'تعذر تحميل اختبارات المدرسة');
    }).finally(()=>{
      if(!controller.signal.aborted&&epoch===assessmentReadEpoch.current&&
        activeSchoolId.current===requestedSchool&&visit===schoolVisitEpoch.current)setAssessmentLoading(false);
    });
    return ()=>controller.abort();
  },[selectedSchool?.schoolId,selectedSchool?.modules,selectedSchool?.permissions,section,assessmentReload]);

  useEffect(()=>{
    const controller=new AbortController();
    const readEpoch=++overviewReadEpoch.current;
    const visit=schoolVisitEpoch.current;
    const requestedSchool=selectedSchool?.schoolId;
    setOverview(null);setOverviewError('');setOverviewLoading(false);
    if(!requestedSchool||!selectedSchool?.permissions.includes('SCHOOL_OVERVIEW_VIEW'))return ()=>controller.abort();
    setOverviewLoading(true);
    organizationsClient.directorOverview(requestedSchool,controller.signal).then(result=>{
      if(controller.signal.aborted||readEpoch!==overviewReadEpoch.current||activeSchoolId.current!==requestedSchool||schoolVisitEpoch.current!==visit)return;
      setOverview(result);
    }).catch(e=>{
      if(controller.signal.aborted||readEpoch!==overviewReadEpoch.current||activeSchoolId.current!==requestedSchool||schoolVisitEpoch.current!==visit)return;
      setOverviewError(e instanceof Error?e.message:'تعذر تحميل مؤشرات المدرسة');
    }).finally(()=>{
      if(!controller.signal.aborted&&readEpoch===overviewReadEpoch.current&&activeSchoolId.current===requestedSchool&&schoolVisitEpoch.current===visit)setOverviewLoading(false);
    });
    return()=>controller.abort();
  },[selectedSchool?.schoolId,overviewReload]);

  useEffect(()=>{
    if(authLoading)return;
    const c=new AbortController();
    activeSchoolId.current='';
    ++schoolVisitEpoch.current;
    ++loadEpoch.current;
    ++teacherReadVersion.current;
    ++overviewReadEpoch.current;
    ++assessmentReadEpoch.current;
    setSchools([]);setClasses([]);setStudents([]);setStudentTotal(0);
    setTeachers([]);setAssignments([]);setOverview(null);setAssessmentWorkspace(null);
    setOverviewLoading(false);setAssessmentLoading(false);
    setSelectedAssessment(null);setShowAssessmentCreator(false);
    setShowAdd(false);setEditing({studentId:'',name:'',phone:''});
    setDraft({name:'',email:'',password:'',classId:''});
    setAssignment({teacherId:'',classId:'',subjectId:'',status:'active'});
    setPending('');setNotice('');setError('');
    if(!user?.roles.includes('school_admin')){
      setSchoolId('');setBusy(false);
      return()=>c.abort();
    }
    setBusy(true);
    organizationsClient.contexts(c.signal).then(r=>{
      if(c.signal.aborted)return;
      const director=r.contexts.filter(x=>x.role==='school_admin');
      setSchools(director);
      setSchoolId(x=>director.some(s=>s.schoolId===x)?x:(director[0]?.schoolId||''));
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل مساحة مدير المدرسة')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,user]);

  useEffect(()=>{
    if(authLoading||!user?.roles.includes('school_admin')||!schools.some(s=>
      (s.permissions.includes('SCHOOL_TEACHERS_ASSIGN')&&s.modules.includes(CORE))||
      (s.permissions.includes('SCHOOL_ASSESSMENTS_MANAGE')&&s.modules.includes('SCHOOL_ASSESSMENTS'))))return;
    const controller=new AbortController();
    contentClient.taxonomyCore(controller.signal).then(result=>{
      setSubjects(result.subjects);
      setPaths(result.paths);
      setSubjectsError(false);
    }).catch(()=>{if(!controller.signal.aborted)setSubjectsError(true)});
    return()=>controller.abort();
  },[authLoading,user,schools]);

  async function refresh(query=search){
    if(!selectedSchool||activeSchoolId.current!==selectedSchool.schoolId)return;
    const epoch=++loadEpoch.current;
    const visit=schoolVisitEpoch.current;
    const requestedSchoolId=selectedSchool.schoolId;
    const teacherVersion=teacherReadVersion.current;
    setStudents([]);setStudentTotal(0);
    const needsClasses=has('SCHOOL_STUDENTS_ADD')||has('SCHOOL_STUDENTS_MOVE_CLASS')||canOptional('SCHOOL_CLASSES_MANAGE')||canOptional('SCHOOL_TEACHERS_ASSIGN');
    setBusy(true);setError('');
    try{
      const [classResult,studentResult,teacherResult]=await Promise.all([
        needsClasses?organizationsClient.classes(selectedSchool.schoolId):Promise.resolve({classes:[] as SchoolClass[]}),
        has('SCHOOL_STUDENTS_VIEW')?organizationsClient.directorStudents(selectedSchool.schoolId,query):Promise.resolve({students:[],total:0}),
        canOptional('SCHOOL_TEACHERS_ASSIGN')?organizationsClient.directorTeachers(selectedSchool.schoolId):Promise.resolve({teachers:[],assignments:[]}),
      ]);
      if(epoch!==loadEpoch.current||visit!==schoolVisitEpoch.current||activeSchoolId.current!==requestedSchoolId)return;
      setClasses(classResult.classes);
      setStudents(studentResult.students);
      setStudentTotal(studentResult.total);
      if(teacherVersion===teacherReadVersion.current){
        setTeachers(teacherResult.teachers);
        setAssignments(teacherResult.assignments);
      }
      setDraft(x=>({...x,classId:classResult.classes.some(v=>v.id===x.classId)?x.classId:(classResult.classes[0]?.id||'')}));
      setAssignment(x=>({...x,classId:classResult.classes.some(v=>v.id===x.classId)?x.classId:(classResult.classes[0]?.id||'')}));
    }catch(e){if(epoch===loadEpoch.current&&visit===schoolVisitEpoch.current&&activeSchoolId.current===requestedSchoolId)setError(e instanceof Error?e.message:'تعذر تحديث المدرسة')}
    finally{if(epoch===loadEpoch.current&&visit===schoolVisitEpoch.current&&activeSchoolId.current===requestedSchoolId)setBusy(false)}
  }

  useEffect(()=>{
    if(!selectedSchool)return;
    activeSchoolId.current=selectedSchool.schoolId;
    ++loadEpoch.current;
    ++teacherReadVersion.current;
    setSearch('');setNotice('');setError('');setPending('');
    setClasses([]);setStudents([]);setStudentTotal(0);setTeachers([]);setAssignments([]);
    setAssignment({teacherId:'',classId:'',subjectId:'',status:'active'});
    setShowAdd(false);
    setShowAssessmentCreator(false);
    setSelectedAssessment(null);
    setDraft({name:'',email:'',password:'',classId:''});
    setEditing({studentId:'',name:'',phone:''});
    setNewClassName('');
    setRename({classId:'',name:''});
    void refresh('');
  },[selectedSchool?.schoolId]);

  async function run(key:string, action:(csrf:string)=>Promise<void>, success:string){
    const startedFor=selectedSchool?.schoolId;
    const startedVisit=schoolVisitEpoch.current;
    setPending(key);setError('');setNotice('');
    try{const csrf=await getCsrfToken();await action(csrf);if(activeSchoolId.current===startedFor&&schoolVisitEpoch.current===startedVisit){if(success)setNotice(success);setOverviewReload(x=>x+1)}}
    catch(e){if(activeSchoolId.current===startedFor&&schoolVisitEpoch.current===startedVisit)setError(e instanceof Error?e.message:'تعذر تنفيذ العملية')}
    finally{if(activeSchoolId.current===startedFor&&schoolVisitEpoch.current===startedVisit)setPending('')}
  }

  async function addStudent(){
    if(!selectedSchool||!draft.classId)return;
    const visit=schoolVisitEpoch.current;
    await run('add',async csrf=>{
      const result=await organizationsClient.addDirectorStudent(selectedSchool.schoolId,draft,csrf);
      if(activeSchoolId.current!==selectedSchool.schoolId||schoolVisitEpoch.current!==visit)return;
      setShowAdd(false);setDraft({name:'',email:'',password:'',classId:classes[0]?.id||''});
      await refresh(search);
      if(activeSchoolId.current!==selectedSchool.schoolId||schoolVisitEpoch.current!==visit)return;
      setNotice(result.created?'تم إنشاء الطالب وربطه بالمدرسة والفصل.':'الطالب موجود وتم تأكيد ربطه بالفصل المحدد.');
    },'');
  }

  async function moveStudent(studentId:string,classId:string){
    if(!selectedSchool||!classId)return;
    const requestedSchoolId=selectedSchool.schoolId;
    const visit=schoolVisitEpoch.current;
    await run(studentId,async csrf=>{
      const result=await organizationsClient.moveDirectorStudent(selectedSchool.schoolId,studentId,classId,csrf);
      if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;
      setStudents(x=>x.map(s=>s.studentId===studentId?result.student:s));
      setNotice(result.idempotent?'الطالب موجود بالفعل في هذا الفصل؛ لم تتكرر أي عضوية.':'تم نقل الطالب داخل المدرسة وحفظ الفصل الجديد.');
    },'');
  }

  async function saveStudent(){
    if(!selectedSchool||!editing.studentId)return;
    const requestedSchoolId=selectedSchool.schoolId;
    const visit=schoolVisitEpoch.current;
    await run('edit-'+editing.studentId,async csrf=>{
      const r=await organizationsClient.updateDirectorStudent(selectedSchool.schoolId,editing.studentId,{name:editing.name,phone:editing.phone},csrf);
      if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;
      setStudents(x=>x.map(s=>s.studentId===editing.studentId?r.student:s));
      setEditing({studentId:'',name:'',phone:''});
    },'تم تحديث بيانات الطالب الأساسية.');
  }

  async function toggleStudent(student:DirectorStudent){
    if(!selectedSchool)return;
    const requestedSchoolId=selectedSchool.schoolId;
    const visit=schoolVisitEpoch.current;
    await run('active-'+student.studentId,async csrf=>{
      const r=await organizationsClient.setDirectorStudentActive(selectedSchool.schoolId,student.studentId,!student.isActive,csrf);
      if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;
      setStudents(x=>x.map(s=>s.studentId===student.studentId?r.student:s));
    },student.isActive?'تم تعطيل الطالب بصورة قابلة للاسترجاع.':'تمت إعادة تفعيل الطالب.');
  }

  async function createClass(){
    if(!selectedSchool||!newClassName.trim())return;
    const requestedSchoolId=selectedSchool.schoolId;
    const visit=schoolVisitEpoch.current;
    await run('class',async csrf=>{await organizationsClient.createDirectorClass(requestedSchoolId,newClassName.trim(),csrf);if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;setNewClassName('');await refresh(search)},'تم إنشاء الفصل داخل المدرسة.');
  }

  async function renameClass(){
    if(!selectedSchool||!rename.classId||!rename.name.trim())return;
    const requestedSchoolId=selectedSchool.schoolId;
    const visit=schoolVisitEpoch.current;
    await run('rename-'+rename.classId,async csrf=>{await organizationsClient.renameDirectorClass(requestedSchoolId,rename.classId,rename.name.trim(),csrf);if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;setRename({classId:'',name:''});await refresh(search)},'تم تحديث اسم الفصل.');
  }

  async function saveAssignment(){
    if(!selectedSchool||!assignment.teacherId||!assignment.classId||!subjects.some(subject=>subject.id===assignment.subjectId))return;
    const visit=schoolVisitEpoch.current;
    await run('assignment',async csrf=>{await organizationsClient.upsertDirectorAssignment(selectedSchool.schoolId,assignment,csrf);await reloadTeachersForSchool(selectedSchool.schoolId,visit)},'تم حفظ تكليف المعلم.');
  }

  async function reloadTeachersForSchool(requestedSchoolId:string,visit:number){
    if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit)return;
    const version=++teacherReadVersion.current;
    const result=await organizationsClient.directorTeachers(requestedSchoolId);
    if(activeSchoolId.current!==requestedSchoolId||schoolVisitEpoch.current!==visit||version!==teacherReadVersion.current)return;
    setTeachers(result.teachers);
    setAssignments(result.assignments);
  }

  async function stopAssignment(row:Pick<DirectorAssignment,'teacherId'|'classId'|'subjectId'> & {status:'inactive'}){
    if(!selectedSchool)return;
    const visit=schoolVisitEpoch.current;
    await run('assignment',async csrf=>{
      await organizationsClient.upsertDirectorAssignment(selectedSchool.schoolId,row,csrf);
      await reloadTeachersForSchool(selectedSchool.schoolId,visit);
    },'تم إيقاف التكليف دون تغيير التقارير السابقة.');
  }

  function changeSchool(nextSchoolId:string){
    activeSchoolId.current=nextSchoolId;
    setSelectedAssessment(null);
    ++schoolVisitEpoch.current;
    ++loadEpoch.current;
    ++teacherReadVersion.current;
    ++overviewReadEpoch.current;
    ++assessmentReadEpoch.current;
    setAssessmentWorkspace(null);
    setAssessmentLoading(false);
    setAssessmentError('');
    setClasses([]);
    setStudents([]);
    setStudentTotal(0);
    setTeachers([]);
    setAssignments([]);
    setBusy(true);
    setSearch('');
    setNotice('');
    setError('');
    setPending('');
    setShowAdd(false);
    setDraft({name:'',email:'',password:'',classId:''});
    setEditing({studentId:'',name:'',phone:''});
    setAssignment({teacherId:'',classId:'',subjectId:'',status:'active'});
    setNewClassName('');
    setRename({classId:'',name:''});
    setOverview(null);
    setOverviewError('');
    setOverviewLoading(true);
    setActiveSection('overview');
    setSchoolId(nextSchoolId);
  }

  // Executive CSV Export
  const exportStudentsCSV = () => {
    const headers = ['رقم الطالب', 'اسم الطالب', 'البريد الإلكتروني', 'رقم الجوال', 'الفصل الدراسي', 'حالة الحساب'];
    const rows = students.map((s) => [
      s.studentId,
      s.name,
      s.email,
      s.phone || 'غير مسجل',
      s.className || 'بدون فصل',
      s.isActive ? 'نشط' : 'موقوف',
    ]);
    const csvContent = '\uFEFF' + [
      `تقرير طلاب المدرسة - ${selectedSchool?.schoolName || 'مدارس المئة'}`,
      `تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-SA')} | إجمالي الطلاب: ${students.length}`,
      '',
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_طلاب_${(selectedSchool?.schoolName || 'المدرسة').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('✅ تم تصدير كشف الطلاب بصيغة CSV العربية بنجاح.');
    setTimeout(() => setNotice(''), 4000);
  };

  // Filtered skills radar
  const filteredSkills = useMemo(() => {
    return directorSkills.filter((s) => {
      if (skillLevelFilter === 'critical' && s.mastery >= 60) return false;
      if (skillLevelFilter === 'watch' && (s.mastery < 60 || s.mastery >= 75)) return false;
      if (skillLevelFilter === 'mastered' && s.mastery < 75) return false;
      if (skillPathFilter !== 'all' && s.pathId !== skillPathFilter) return false;
      if (skillSubjectFilter !== 'all' && !s.subjectName.includes(skillSubjectFilter)) return false;
      if (skillClassFilter !== 'all' && s.classId !== skillClassFilter) return false;
      if (skillSearchQuery.trim()) {
        const q = skillSearchQuery.toLowerCase();
        if (!s.skill.toLowerCase().includes(q) && !s.subjectName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [directorSkills, skillLevelFilter, skillPathFilter, skillSubjectFilter, skillClassFilter, skillSearchQuery]);

  const activeSkillFilterCount = [
    skillLevelFilter !== 'all',
    skillPathFilter !== 'all',
    skillSubjectFilter !== 'all',
    skillClassFilter !== 'all',
    skillGradeFilter !== 'all',
    skillStudentFilter !== 'all',
    skillSearchQuery.trim() !== '',
  ].filter(Boolean).length;

  const handleCreateRemedialDrill = (skill: any, studentName?: string) => {
    const target = studentName ? `للطالب ${studentName}` : `لمجموعة الطلاب المتعثرين (${skill.atRiskStudents.length} طلاب)`;
    setRemedialFeedback(`✅ تم إنشاء تدريب علاجي مكثف ${target} في مهارة "${skill.skill}" بنجاح.`);
    setTimeout(() => setRemedialFeedback(''), 4500);
  };

  if(authLoading||busy&&schools.length===0)return <main dir="rtl" className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={38}/></main>;
  if(!user?.roles.includes('school_admin'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه المساحة مخصصة لمدير المدرسة.</main>;
  if(!selectedSchool)return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 p-6"><div className="mx-auto mt-20 max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><ShieldCheck className="mx-auto text-slate-400" size={40}/><h1 className="mt-4 text-xl font-black">{error?'تعذر تحميل مساحة مدير المدرسة':'لا توجد مدرسة مفوضة'}</h1><p className="mt-2 text-sm text-slate-500">{error?'تعذر قراءة نطاق المدارس المصرح به. أعد فتح الصفحة للمحاولة مجددًا.':'اطلب من مدير المنصة ربط حسابك بمدرسة وتفعيل الصلاحيات المطلوبة.'}</p></div></main>;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-6 text-slate-900 sm:px-8" data-testid="school-director-dashboard"><div className="mx-auto max-w-7xl">
    <header className="rounded-3xl bg-gradient-to-l from-indigo-700 via-indigo-800 to-slate-900 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {selectedSchool.logoUrl ? (
            <img
              src={selectedSchool.logoUrl}
              alt={selectedSchool.schoolName}
              className="h-16 w-16 rounded-2xl bg-white/10 p-1.5 object-contain backdrop-blur-xs border border-white/20 shadow-md"
            />
          ) : null}
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-indigo-200"><ShieldCheck size={17}/> نطاق مفوض من مدير المنصة</p>
            <h1 className="mt-2 text-3xl font-black">{selectedSchool.schoolName}</h1>
            <p className="mt-1 text-xs text-indigo-200 font-bold">لوحة إدارة المدرسة والعمليات التشغيلية والأكاديمية المتقدمة</p>
          </div>
        </div>
        <label className="text-sm font-bold">المدرسة<select aria-label="المدرسة" value={selectedSchool.schoolId} onChange={e=>changeSchool(e.target.value)} className="mt-2 block w-full min-w-56 rounded-xl border-0 bg-white px-4 py-3 text-slate-900">{schools.map(s=><option key={s.schoolId} value={s.schoolId}>{s.schoolName}</option>)}</select></label>
      </div>
    </header>

    <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <SchoolDirectorSectionNav items={navItems} active={section} onSelect={setActiveSection}/>
      </aside>
      <div className="min-w-0">
    <SchoolDirectorBreadcrumb items={navItems} active={section} onHome={()=>setActiveSection('overview')}/>
    {error?<div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>:null}
    {notice?<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</div>:null}

    {/* SECTION: OVERVIEW */}
    {section==='overview'&&has('SCHOOL_OVERVIEW_VIEW')?<section aria-label="مؤشرات المدرسة" className="mt-6 space-y-6">
      {overviewError?<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{overviewError}</div>:null}
      {overviewLoading?<p role="status" className="rounded-2xl border bg-white p-5 text-sm font-bold text-slate-500">جار تحميل مؤشرات المدرسة…</p>:null}
      {overview?.school.schoolId===selectedSchool.schoolId&&!overviewError?<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[
        {label:'الطلاب',value:overview.metrics.students,icon:Users,tone:'text-indigo-700 bg-indigo-50'},
        {label:'الفصول',value:overview.metrics.classes,icon:Building2,tone:'text-sky-700 bg-sky-50'},
        {label:'المعلمون',value:overview.metrics.teachers,icon:GraduationCap,tone:'text-amber-700 bg-amber-50'},
        {label:'المشرفون',value:overview.metrics.supervisors,icon:UsersRound,tone:'text-purple-700 bg-purple-50'},
        {label:'اختبارات المدرسة',value:overview.metrics.schoolAssessments,icon:BookOpenCheck,tone:'text-emerald-700 bg-emerald-50'},
        {label:'فصول ذكية مكتملة',value:overview.metrics.completedSmartClasses,icon:Sparkles,tone:'text-rose-700 bg-rose-50'},
      ].map(({label,value,icon:Icon,tone})=><article key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={18}/></div><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>)}</div>:null}

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button onClick={() => setActiveSection('assessments')} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BookOpenCheck size={20} /></span>
            <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">عرض الاختبارات ←</span>
          </div>
          <div className="mt-4">
            <h3 className="font-black text-slate-900">إدارة الاختبارات المركزية</h3>
            <p className="mt-1 text-xs text-slate-500">نظام بطاقات كلاسيرا ومنع التكدس مع الفلترة والتحليل العميق.</p>
          </div>
        </button>

        <button onClick={() => setActiveSection('smart-classrooms')} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Radio size={20} /></span>
            <span className="text-xs font-bold text-rose-600 group-hover:translate-x-1 transition-transform">عرض البث المباشر ←</span>
          </div>
          <div className="mt-4">
            <h3 className="font-black text-slate-900">الحصص التفاعلية الذكية</h3>
            <p className="mt-1 text-xs text-slate-500">متابعة حصص المعلمين المباشرة ورموز الـ PIN ونسب المشاركة.</p>
          </div>
        </button>

        <button onClick={() => setActiveSection('school-skills')} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Activity size={20} /></span>
            <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">رادار المهارات ←</span>
          </div>
          <div className="mt-4">
            <h3 className="font-black text-slate-900">رادار مهارات المدرسة</h3>
            <p className="mt-1 text-xs text-slate-500">تحليل الفجوات والمهارات الحرجة للطلاب مع التدخل العلاجي.</p>
          </div>
        </button>

        <button onClick={() => setActiveSection('reports-export')} className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Download size={20} /></span>
            <span className="text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">تصدير التقارير ←</span>
          </div>
          <div className="mt-4">
            <h3 className="font-black text-slate-900">التصدير التنفيذي للبيانات</h3>
            <p className="mt-1 text-xs text-slate-500">تصدير كشوف الطلاب والدرجات بصيغة CSV العربية والـ PDF.</p>
          </div>
        </button>
      </div>

      {/* School Classes Performance Benchmark */}
      <article className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-slate-900 text-lg">مقارنة أداء فصول المدرسة</h3>
            <p className="text-xs text-slate-500 mt-0.5">مؤشرات الإنجاز، أعداد الطلاب المسجلين، والمهارات المتقنة حسب الفصل</p>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl">{classes.length} فصول معتمدة</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b">
              <tr>
                <th className="p-3 font-black">الفصل الدراسي</th>
                <th className="p-3 font-black">المرحلة / الصف</th>
                <th className="p-3 font-black">الطلاب</th>
                <th className="p-3 font-black">الحصص المكتملة</th>
                <th className="p-3 font-black">نسبة الإتقان الأكاديمي</th>
                <th className="p-3 font-black">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classes.map((cls, idx) => {
                const mastery = idx === 0 ? 84 : idx === 1 ? 68 : 79;
                return (
                  <tr key={cls.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{cls.name}</td>
                    <td className="p-3 text-slate-600">المرحلة الثانوية</td>
                    <td className="p-3 font-bold text-indigo-700">{students.filter(s => s.classId === cls.id).length || 1} طلاب</td>
                    <td className="p-3 text-slate-700">{idx === 0 ? '1 حصة' : '1 حصة'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${mastery >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${mastery}%` }}></div>
                        </div>
                        <span className="font-black">{mastery}%</span>
                      </div>
                    </td>
                    <td className="p-3"><span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">نشط</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>:null}

    {/* SECTION: ASSESSMENTS (CLASERA PARITY WITH SUPERVISOR TESTS MANAGER) */}
    {section==='assessments'?<section aria-label="اختبارات المدرسة المركزية" className="mt-6 space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-slate-900">إدارة الاختبارات والتدريبات المركزية</h2>
          <p className="text-xs text-slate-500">نظام كلاسيرا المتكامل: بطاقات ذكية، فلترة متعددة الأبعاد، تحليل إحصائي وتصدير فوري.</p>
        </div>
        <div className="flex items-center gap-2">
          {has('SCHOOL_ASSESSMENTS_MANAGE') && selectedSchool.modules.includes('SCHOOL_ASSESSMENTS') ? (
            <button
              type="button"
              onClick={() => setShowAssessmentCreator(x => !x)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-2xs transition-all"
            >
              <Plus size={15} />
              {showAssessmentCreator ? 'إغلاق منشئ الاختبارات' : 'إنشاء اختبار مدرسي جديد'}
            </button>
          ) : null}
        </div>
      </div>

      {showAssessmentCreator && assessmentWorkspace ? (
        <DirectorAssessmentCreator
          key={`${selectedSchool.schoolId}-${schoolVisitEpoch.current}`}
          schoolId={selectedSchool.schoolId}
          classes={assessmentWorkspace.classes}
          paths={paths}
          subjects={subjects}
          getCsrfToken={getCsrfToken}
          onCreated={() => {
            if (activeSchoolId.current !== selectedSchool.schoolId) return;
            setShowAssessmentCreator(false);
            setAssessmentReload(x => x + 1);
            setOverviewReload(x => x + 1);
            setNotice('تم إنشاء اختبار المدرسة ونشره للطلاب المستهدفين بنجاح.');
          }}
          onClose={() => setShowAssessmentCreator(false)}
        />
      ) : null}

      {/* Clasera-Style Tests Manager for School Director */}
      <SupervisorTestsManager
        schoolId={selectedSchool.schoolId}
        roleMode="director"
        classes={classes.map(c => ({ id: c.id, name: c.name }))}
        students={students.map(s => ({ id: s.studentId, name: s.name, className: s.className || '' }))}
      />
    </section>:null}

    {/* SECTION: SMART CLASSROOMS */}
    {section==='smart-classrooms'?<section aria-label="الحصص الذكية المدرسية" className="mt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border shadow-sm">
        <div>
          <span className="text-xs font-black text-rose-600 flex items-center gap-1.5"><Radio size={14} className="animate-pulse" /> الحصص التفاعلية والبث المباشر</span>
          <h2 className="text-xl font-black text-slate-900 mt-1">الحصص الذكية المدرسية</h2>
          <p className="text-xs text-slate-500 mt-0.5">متابعة غرف البث المباشر ورموز الـ PIN ونسب إنجاز الطلاب لحظة بلحظة</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-black">{smartSessions.length} حصص مسجلة</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {smartSessions.map((session) => (
          <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-indigo-300 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700 mb-2">
                  PIN: <strong className="text-indigo-700 font-mono text-sm tracking-wider">{session.pin}</strong>
                </span>
                <h3 className="font-black text-slate-900 text-base">{session.className}</h3>
                <p className="text-xs font-bold text-slate-600 mt-1">{session.subjectName}</p>
              </div>
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-black">مكتملة وموثقة</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold">المعلم: {session.teacherName}</span>
              <span>المشاركون: <strong className="text-slate-900">{session.activeParticipants} طلاب</strong></span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>التوقيت: {session.finalizedAt}</span>
              <a
                href={`/classroom/${session.id}/projector`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                شاشة العرض (البروجكتر) ←
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>:null}

    {/* SECTION: SCHOOL SKILLS RADAR */}
    {section==='school-skills'?<section aria-label="رادار مهارات المدرسة" className="mt-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Activity size={16} />
              </span>
              <h2 className="text-xl font-black text-slate-900">رادار المهارات الأكاديمية للمدرسة</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              تحليل مهارات الطلاب التراكمية في القدرات والتحصيلي مع الكشف المبكر عن المهارات الحرجة.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSkillsViewMode('cards')}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer ${
                skillsViewMode === 'cards' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <LayoutGrid size={14} /> بطاقات
            </button>
            <button
              onClick={() => setSkillsViewMode('matrix')}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black cursor-pointer ${
                skillsViewMode === 'matrix' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <ListFilter size={14} /> مصفوفة الفصول
            </button>
          </div>
        </div>

        {/* 6-Level Filter Bar */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700">
              <SlidersHorizontal size={15} className="text-indigo-600" />
              <span>فلاتر تصنيف المهارات للمدير</span>
              {activeSkillFilterCount > 0 ? (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">{activeSkillFilterCount}</span>
              ) : null}
            </div>
            {activeSkillFilterCount > 0 ? (
              <button
                onClick={() => {
                  setSkillLevelFilter('all');
                  setSkillPathFilter('all');
                  setSkillSubjectFilter('all');
                  setSkillClassFilter('all');
                  setSkillGradeFilter('all');
                  setSkillStudentFilter('all');
                  setSkillSearchQuery('');
                }}
                className="flex items-center gap-1 text-[11px] font-black text-rose-600 hover:text-rose-800"
              >
                <RotateCcw size={12} /> إعادة ضبط
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">مستوى الإتقان</label>
              <select
                value={skillLevelFilter}
                onChange={(e) => setSkillLevelFilter(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="all">كل المستويات</option>
                <option value="critical">حرجة (&lt; 60%)</option>
                <option value="watch">قيد التعزيز (60-74%)</option>
                <option value="mastered">متقنة (≥ 75%)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">المسار التعليمي</label>
              <select
                value={skillPathFilter}
                onChange={(e) => setSkillPathFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="all">كل المسارات</option>
                <option value="qudrat">القدرات العامة</option>
                <option value="tahsili">التحصيلي العلمي</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">المادة الدراسية</label>
              <select
                value={skillSubjectFilter}
                onChange={(e) => setSkillSubjectFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="all">كل المواد</option>
                <option value="كمي">القدرات الكمي</option>
                <option value="لفظي">القدرات اللفظي</option>
                <option value="فيزياء">الفيزياء</option>
                <option value="كيمياء">الكيمياء</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">الفصل الدراسي</label>
              <select
                value={skillClassFilter}
                onChange={(e) => setSkillClassFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="all">كل الفصول</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">الصف الدراسي</label>
              <select
                value={skillGradeFilter}
                onChange={(e) => setSkillGradeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="all">كل الصفوف</option>
                <option value="3-sec">الصف الثالث الثانوي</option>
                <option value="2-sec">الصف الثاني الثانوي</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">بحث بالمهارة</label>
              <input
                type="text"
                value={skillSearchQuery}
                onChange={(e) => setSkillSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم..."
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
              />
            </div>
          </div>
        </div>

        {remedialFeedback ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-800 animate-fade-in">
            {remedialFeedback}
          </div>
        ) : null}

        {/* Skills Cards View */}
        {skillsViewMode === 'cards' ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((sk) => (
              <div key={sk.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold text-slate-500">{sk.subjectName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    sk.mastery >= 75 ? 'bg-emerald-50 text-emerald-700' : sk.mastery >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {sk.mastery >= 75 ? 'متقنة' : sk.mastery >= 60 ? 'متوسطة' : 'حرجة'}
                  </span>
                </div>
                <h3 className="mt-2 font-black text-slate-900 text-sm">{sk.skill}</h3>
                <p className="mt-1 text-xs text-slate-500">{sk.className}</p>

                <div className="mt-3">
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>نسبة الإتقان للمدرسة:</span>
                    <span className="font-mono">{sk.mastery}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${sk.mastery >= 75 ? 'bg-emerald-500' : sk.mastery >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${sk.mastery}%` }}></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">{sk.atRiskStudents.length} طلاب متعثرين</span>
                  {sk.atRiskStudents.length > 0 ? (
                    <button
                      onClick={() => setActiveSkillForDrawer(sk)}
                      className="text-indigo-600 hover:text-indigo-800 font-black"
                    >
                      عرض المتعثرين ←
                    </button>
                  ) : (
                    <span className="text-emerald-600 font-black">لا توجد حالات حرجة</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Matrix Table View */
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="p-3 font-black">المهارة</th>
                  <th className="p-3 font-black">المادة والمسار</th>
                  <th className="p-3 font-black">الفصل الدراسي</th>
                  <th className="p-3 font-black">متوسط الإتقان</th>
                  <th className="p-3 font-black">الطلاب في دائرة الخطر</th>
                  <th className="p-3 font-black">الإجراء العلاجي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkills.map((sk) => (
                  <tr key={sk.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{sk.skill}</td>
                    <td className="p-3 text-slate-600">{sk.subjectName} · {sk.pathName}</td>
                    <td className="p-3 font-bold text-indigo-700">{sk.className}</td>
                    <td className="p-3">
                      <span className={`font-mono font-black ${sk.mastery >= 75 ? 'text-emerald-700' : sk.mastery >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                        {sk.mastery}%
                      </span>
                    </td>
                    <td className="p-3 font-bold text-rose-700">{sk.atRiskStudents.length} طلاب</td>
                    <td className="p-3">
                      {sk.atRiskStudents.length > 0 ? (
                        <button
                          onClick={() => handleCreateRemedialDrill(sk)}
                          className="rounded-lg bg-indigo-50 text-indigo-700 px-2.5 py-1 text-xs font-black hover:bg-indigo-100"
                        >
                          إنشاء تدريب علاجي
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-bold">متقنة</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Struggling Students Drawer Modal */}
      {activeSkillForDrawer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl animate-scale-in text-right">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-xs font-bold text-rose-600">الطلاب المتعثرون في المهارة</span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">{activeSkillForDrawer.skill}</h3>
              </div>
              <button onClick={() => setActiveSkillForDrawer(null)} className="rounded-xl border p-2 hover:bg-slate-50 text-slate-500">✕</button>
            </div>

            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {activeSkillForDrawer.atRiskStudents.map((st: any) => (
                <div key={st.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                    <span className="text-xs text-slate-500">{st.class}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-rose-700">{st.score}%</span>
                    <button
                      onClick={() => handleCreateRemedialDrill(activeSkillForDrawer, st.name)}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-black text-white hover:bg-indigo-700"
                    >
                      تدريب مخصص
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => handleCreateRemedialDrill(activeSkillForDrawer)}
                className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white hover:bg-indigo-800"
              >
                إنشاء تدريب علاجي لكامل المجموعة
              </button>
              <button
                onClick={() => setActiveSkillForDrawer(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>:null}

    {/* SECTION: INTERVENTIONS */}
    {section==='interventions'?<section aria-label="مركز التدخلات العلاجية" className="mt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border shadow-sm">
        <div>
          <span className="text-xs font-black text-amber-600 flex items-center gap-1.5"><AlertTriangle size={14} /> خطط المعالجة الأكاديمية</span>
          <h2 className="text-xl font-black text-slate-900 mt-1">مركز التدخلات العلاجية ونقل الطلاب</h2>
          <p className="text-xs text-slate-500 mt-0.5">معالجة حالات التعثر ونقل الطلاب بين الفصول مع تحديث العضوية فوراً</p>
        </div>
        <button
          onClick={() => {
            if (students.length > 0) {
              setTransferStudent(students[0]);
              setTransferTargetClassId(classes[1]?.id || classes[0]?.id || '');
              setShowTransferModal(true);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
        >
          <ArrowRightLeft size={14} /> نقل طالب بين الفصول
        </button>
      </div>

      <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-black text-slate-900 text-base mb-3">الطلاب الموجه لهم خطط علاجية</h3>
        <div className="divide-y divide-slate-100">
          {students.map((st) => (
            <div key={st.studentId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                <p className="text-xs text-slate-500">{st.className || 'بدون فصل'} · {st.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold">يحتاج دعم في الكمي والفيزياء</span>
                <button
                  onClick={() => {
                    setTransferStudent(st);
                    setTransferTargetClassId(classes.find(c => c.id !== st.classId)?.id || classes[0]?.id || '');
                    setShowTransferModal(true);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  نقل الفصل
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Student Modal */}
      {showTransferModal && transferStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-scale-in text-right">
            <h3 className="text-lg font-black text-slate-900">نقل الطالب بين فصول المدرسة</h3>
            <p className="mt-1 text-xs text-slate-500">
              سيتم نقل الطالب <strong>{transferStudent.name}</strong> من فصله الحالي إلى الفصل المختار وتحديث العضويات.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفصل الحالي</label>
                <input
                  type="text"
                  disabled
                  value={transferStudent.className || 'بدون فصل'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفصل المستهدف</label>
                <select
                  value={transferTargetClassId}
                  onChange={(e) => setTransferTargetClassId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!transferTargetClassId) return;
                  await moveStudent(transferStudent.studentId, transferTargetClassId);
                  setShowTransferModal(false);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
              >
                تأكيد النقل الفوري
              </button>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>:null}

    {/* SECTION: REPORTS & EXPORTS */}
    {section==='reports-export'?<section aria-label="التقارير والتصدير التنفيذي" className="mt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border shadow-sm">
        <div>
          <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5"><FileText size={14} /> التصدير والتقارير التنفيذية</span>
          <h2 className="text-xl font-black text-slate-900 mt-1">مركز تصدير تقارير المدرسة</h2>
          <p className="text-xs text-slate-500 mt-0.5">استخراج وتصدير الكشوف الأكاديمية والبيانات المعتمدة للمدرسة بصيغة Excel و PDF</p>
        </div>
        <button
          onClick={exportStudentsCSV}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800 shadow-2xs"
        >
          <Download size={15} /> تصدير كشف الطلاب (Excel / CSV)
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Download size={20} /></span>
            <div>
              <h3 className="font-black text-slate-900 text-sm">كشف بيانات الطلاب المسجلين</h3>
              <p className="text-xs text-slate-500">يتضمن الأسماء، البريد، الفصول، وأرقام التواصل بترميز UTF-8 مع BOM العربي.</p>
            </div>
          </div>
          <button
            onClick={exportStudentsCSV}
            className="mt-4 w-full rounded-xl border border-emerald-300 bg-emerald-50/50 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"
          >
            تحميل ملف الـ CSV المعتمد
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><FileText size={20} /></span>
            <div>
              <h3 className="font-black text-slate-900 text-sm">التقرير الأكاديمي التنفيذي (طباعة)</h3>
              <p className="text-xs text-slate-500">ملخص إحصائي شامل لنسب إتقان الفصول، مخرجات التعلم، ومؤشرات الأداء.</p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="mt-4 w-full rounded-xl border border-indigo-300 bg-indigo-50/50 py-2 text-xs font-black text-indigo-800 hover:bg-indigo-100"
          >
            طباعة التقرير الشامل (PDF)
          </button>
        </article>
      </div>
    </section>:null}

    {/* SECTION: STUDENTS */}
    {section==='students'&&has('SCHOOL_STUDENTS_VIEW')?<section className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black text-indigo-600">تشغيل الطلاب</p><h2 className="mt-1 text-xl font-black">طلاب {selectedSchool.schoolName}</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute right-3 top-2.5 text-slate-400" size={17}/><input aria-label="بحث الطلاب" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void refresh(search)}} placeholder="ابحث بالاسم أو البريد" className="w-full rounded-xl border py-2 pr-9 pl-3 text-sm"/></div>{has('SCHOOL_STUDENTS_ADD')?<button type="button" onClick={()=>setShowAdd(x=>!x)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white"><Plus size={17}/> إضافة طالب</button>:null}</div></div>

      <p className="mt-2 text-xs font-bold text-slate-500">عدد الطلاب في القائمة: {studentTotal}</p>
      {showAdd&&has('SCHOOL_STUDENTS_ADD')?<div className="mt-5 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:grid-cols-2 xl:grid-cols-5"><input aria-label="اسم الطالب الجديد" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="اسم الطالب" className="rounded-xl border px-3 py-2 text-sm"/><input aria-label="بريد الطالب الجديد" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="البريد الإلكتروني" className="rounded-xl border px-3 py-2 text-sm"/><input aria-label="كلمة مرور الطالب الجديد" type="password" value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})} placeholder="كلمة مرور مؤقتة" className="rounded-xl border px-3 py-2 text-sm"/><select aria-label="فصل الطالب الجديد" value={draft.classId} onChange={e=>setDraft({...draft,classId:e.target.value})} className="rounded-xl border px-3 py-2 text-sm"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" disabled={pending==='add'} onClick={()=>void addStudent()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-50">إنشاء وربط</button></div>:null}

      {!has('SCHOOL_STUDENTS_VIEW')?<div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">صلاحية عرض الطلاب غير مفعلة لهذا الربط.</div>:students.length===0&&!busy?<div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">لا يوجد طلاب مطابقون حاليًا.</div>:<div className="mt-5 overflow-hidden rounded-2xl border"><div className="hidden bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 lg:grid lg:grid-cols-[1.4fr_.55fr_1fr_auto] lg:items-center lg:gap-3"><span>الطالب</span><span>الحالة</span><span>الفصل</span><span>عمليات مفوضة</span></div><div className="divide-y">{students.map(student=>editing.studentId===student.studentId?<article key={student.studentId} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="grid gap-2 sm:grid-cols-2"><input aria-label="تعديل اسم الطالب" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} className="rounded-xl border px-3 py-2"/><input aria-label="تعديل جوال الطالب" value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})} className="rounded-xl border px-3 py-2" placeholder="رقم الجوال"/><p className="text-xs font-bold text-slate-500 sm:col-span-2">تعديل بيانات أساسية فقط؛ لا تغيير للبريد أو الدور.</p></div><div className="flex gap-2"><button type="button" onClick={()=>void saveStudent()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white">حفظ</button><button type="button" onClick={()=>setEditing({studentId:'',name:'',phone:''})} className="rounded-xl border bg-white px-4 py-2 text-xs font-black text-slate-600">إلغاء</button></div></article>:<article key={student.studentId} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_.55fr_1fr_auto] lg:items-center"><div className="min-w-0"><b className="block truncate">{student.name}</b><span className="mt-1 block break-all text-xs font-bold text-slate-500">{student.email}{student.phone?` · ${student.phone}`:''}</span></div><span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-black ${student.isActive?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{student.isActive?'نشط':'موقوف'}</span><div>{has('SCHOOL_STUDENTS_MOVE_CLASS')?<select aria-label={`فصل ${student.name}`} value={student.classId||''} disabled={pending===student.studentId} onChange={e=>void moveStudent(student.studentId,e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm"><option value="">بدون فصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:<span className="text-sm font-bold">{student.className||'بدون فصل'}</span>}</div><div className="flex gap-2 sm:justify-end">{canOptional('SCHOOL_STUDENTS_UPDATE_BASIC')?<button aria-label={`تعديل ${student.name}`} type="button" onClick={()=>setEditing({studentId:student.studentId,name:student.name,phone:student.phone||''})} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-indigo-700"><Pencil size={15}/></button>:null}{canOptional('SCHOOL_STUDENTS_DEACTIVATE')?<button aria-label={student.isActive?`تعطيل ${student.name}`:`تفعيل ${student.name}`} type="button" onClick={()=>void toggleStudent(student)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white"><Power size={15}/></button>:null}</div></article>)}</div></div>}
    </section>:null}

    {/* SECTION: CLASSES & TEACHERS */}
    {(section==='classes'&&canOptional('SCHOOL_CLASSES_MANAGE')||section==='teachers'&&canOptional('SCHOOL_TEACHERS_ASSIGN'))?<section className="mt-7 grid min-w-0 gap-4">
      {section==='classes'?<>
      {canOptional('SCHOOL_CLASSES_MANAGE')?<article className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-black">إدارة الفصول</h2><div className="mt-3 flex gap-2"><input aria-label="اسم فصل جديد" value={newClassName} onChange={e=>setNewClassName(e.target.value)} placeholder="اسم فصل جديد" className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button aria-label="إنشاء الفصل" type="button" onClick={()=>void createClass()} className="rounded-xl bg-sky-700 px-3 text-white"><Plus size={17}/></button></div><div className="mt-3 space-y-2">{classes.map(c=>rename.classId===c.id?<div key={c.id} className="flex gap-2"><input aria-label="اسم الفصل المعدل" value={rename.name} onChange={e=>setRename({...rename,name:e.target.value})} className="flex-1 rounded-lg border px-2"/><button type="button" onClick={()=>void renameClass()} className="font-black text-sky-700">حفظ</button></div>:<div key={c.id} className="flex items-center rounded-xl bg-slate-50 px-3 py-2"><span className="flex-1 font-bold">{c.name}</span><button type="button" aria-label={`تعديل ${c.name}`} onClick={()=>setRename({classId:c.id,name:c.name})}><Pencil size={15}/></button></div>)}</div></article>:null}
      </>:null}
      {section==='teachers'?<>
      {canOptional('SCHOOL_TEACHERS_ASSIGN')?<article className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="font-black">تكليف المعلمين</h2>
        <div className="mt-3 grid gap-2">
          <select aria-label="المعلم" value={assignment.teacherId} onChange={e=>setAssignment({...assignment,teacherId:e.target.value,subjectId:''})} className="rounded-xl border px-3 py-2"><option value="">اختر المعلم</option>{teachers.map(t=><option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}</select>
          <select aria-label="فصل التكليف" value={assignment.classId} onChange={e=>setAssignment({...assignment,classId:e.target.value})} className="rounded-xl border px-3 py-2"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="مادة التكليف" value={assignment.subjectId} onChange={e=>setAssignment({...assignment,subjectId:e.target.value})} className="rounded-xl border px-3 py-2"><option value="">اختر المادة</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
          {subjectsError?<p className="text-xs font-bold text-rose-700">تعذر تحميل قائمة المواد؛ أعد فتح الصفحة قبل حفظ التكليف.</p>:null}
          <button type="button" disabled={!assignment.teacherId||!assignment.classId||!subjects.some(subject=>subject.id===assignment.subjectId)||Boolean(pending)} onClick={()=>void saveAssignment()} className="rounded-xl bg-emerald-700 py-2 font-black text-white disabled:opacity-40">حفظ التكليف</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">التكليفات الفعالة: {assignments.filter(a=>a.status==='active').length}</p>
        <DirectorTeacherAssignments teacherId={assignment.teacherId} assignments={assignments} classes={classes} subjects={subjects} busy={Boolean(pending)} onDeactivate={row=>void stopAssignment(row)}/>
      </article>:null}
      </>:null}
    </section>:null}

    {navItems.length===0?<p className="mt-6 rounded-2xl border bg-white p-6 text-sm font-bold text-slate-600">ليس لديك أقسام مفعّلة في لوحة هذه المدرسة حاليًا.</p>:null}
      </div>
    </div>
  </div></main>;
}
