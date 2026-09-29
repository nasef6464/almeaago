import {
  ArrowDown,
  ArrowLeft,
  Award,
  BarChart3,
  Book,
  BookOpen,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Quote,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore, TaxonomyPath } from '../../content/api/content-types';
import { useAuth } from '../../auth/state/AuthProvider';
import { dashboardPathFor } from '../../auth/utils/dashboard-path';
import {
  DEFAULT_PUBLIC_ARTICLES,
  DEFAULT_PUBLIC_TESTIMONIALS,
  LEGACY_HERO_GALLERY,
  PLATFORM_DAYLIGHT_IMAGES,
  PLATFORM_SHOWCASE_IMAGES,
  type PublicArticle,
} from '../legacy-public-data';

const pathPalettes = [
  { base:'#4f46e5', soft:'#eef2ff', text:'#4338ca', border:'#e0e7ff' },
  { base:'#0284c7', soft:'#f0f9ff', text:'#0369a1', border:'#bae6fd' },
  { base:'#0d9488', soft:'#f0fdfa', text:'#0f766e', border:'#99f6e4' },
  { base:'#ca8a04', soft:'#fefce8', text:'#a16207', border:'#fef08a' },
  { base:'#c026d3', soft:'#fdf4ff', text:'#a21caf', border:'#f5d0fe' },
  { base:'#ea580c', soft:'#fff7ed', text:'#c2410c', border:'#fed7aa' },
];

function pathIcon(index:number) {
  const icons = [<Target key="target" size={24}/>, <BookOpen key="book-open" size={24}/>, <Award key="award" size={24}/>, <Book key="book" size={24}/>];
  return icons[index % icons.length];
}

function OrganicPathCard({path,index}:{path:TaxonomyPath;index:number}) {
  const palette=pathPalettes[index%pathPalettes.length];
  return (
    <Link to={`/learning?pathId=${encodeURIComponent(path.id)}`} className="group block h-full w-full">
      <div
        className="relative flex min-h-[176px] w-full flex-col items-center justify-between overflow-hidden rounded-3xl border p-6 shadow-sm transition-all duration-500 ease-out hover:-translate-y-2.5 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]"
        style={{borderColor:palette.border,backgroundColor:'#fff'}}
      >
        <div className="relative z-10 flex w-full flex-col items-center text-center">
          <div className="mb-3.5 rounded-2xl p-3.5 shadow-sm transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" style={{backgroundColor:palette.soft,color:palette.text}}>
            {pathIcon(index)}
          </div>
          <h3 className="mb-1.5 break-words text-lg font-black tracking-tight text-gray-900 sm:text-xl">{path.name}</h3>
          <p className="line-clamp-2 px-2 text-xs font-medium leading-relaxed text-gray-500">{path.description || 'تأسيس وتدريب شامل'}</p>
        </div>
        <div className="relative z-10 mt-4 inline-flex items-center gap-1.5 text-xs font-black transition-colors" style={{color:palette.text}}>
          <span>استكشف المسار</span>
          <ArrowLeft size={13} className="transition-transform duration-300 group-hover:-translate-x-1.5"/>
        </div>
      </div>
    </Link>
  );
}

function FeatureCard({
  icon,title,description,badge,classes,
}:{
  icon:React.ReactNode;title:string;description:string;badge:string;classes:string;
}) {
  return (
    <div className="group relative flex h-full flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-300 hover:shadow-xl sm:p-6">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-300 group-hover:scale-110 ${classes}`}>{icon}</div>
          <span className="rounded-full border border-current/20 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-700">{badge}</span>
        </div>
        <h3 className="mb-2 text-base font-black text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-lg">{title}</h3>
        <p className="text-xs font-normal leading-relaxed text-gray-500 sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

function TestimonialCard({name,degree,text,image}:{name:string;degree:string;text:string;image:string}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-amber-400/40 hover:bg-white/[0.12] hover:shadow-2xl sm:p-7">
      <Quote size={52} className="pointer-events-none absolute -left-3 -top-3 text-white/[0.04] transition-colors group-hover:text-amber-400/10"/>
      <div>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img src={image} alt={name} className="h-12 w-12 rounded-full border-2 border-amber-400/80 object-cover shadow-sm"/>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white shadow-sm">✓</span>
            </div>
            <div className="text-right">
              <h4 className="text-sm font-black text-white transition-colors group-hover:text-amber-200 sm:text-base">{name}</h4>
              <span className="text-[11px] font-bold text-white/60">مشترك معتمد</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-black text-amber-300 shadow-sm">
            <Trophy size={12}/>{degree}
          </span>
        </div>
        <p className="mb-6 text-sm font-medium italic leading-relaxed text-indigo-100/90 sm:text-base">"{text}"</p>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex gap-1 text-amber-400">{[0,1,2,3,4].map(i=><Star key={i} size={15} fill="currentColor"/>)}</div>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><CheckCircle size={12}/> تجربة موثقة</span>
      </div>
    </div>
  );
}

function ArticleModal({article,onClose}:{article:PublicArticle;onClose():void}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={article.title}>
      <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <span className="text-xs font-black text-indigo-600">{article.category}</span>
            <h2 className="mt-1 text-xl font-black leading-8 text-slate-950 sm:text-2xl">{article.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق المقال" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={20}/></button>
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-7">
          <p className="text-sm font-bold leading-8 text-slate-600">{article.summary}</p>
          {article.content.map((paragraph,index)=><p key={index} className="text-sm leading-8 text-slate-700 sm:text-base">{paragraph}</p>)}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black leading-7 text-amber-900">{article.keyTakeaway}</div>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
            <span>{article.authorName}</span><span>·</span><span>{article.authorRole}</span><span>·</span><span>{article.readTime}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

export function PublicLandingPage({onAuth}:{onAuth(mode:'login'|'signup'):void}) {
  const {user}=useAuth();
  const [taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});
  const [currentHeroIndex,setCurrentHeroIndex]=useState(0);
  const [isHeroHovered,setIsHeroHovered]=useState(false);
  const [showcaseTab,setShowcaseTab]=useState<'daylight'|'neon'>('daylight');
  const [selectedArticle,setSelectedArticle]=useState<PublicArticle|null>(null);

  useEffect(()=>{
    const controller=new AbortController();
    contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(()=>{});
    return()=>controller.abort();
  },[]);

  useEffect(()=>{
    if(isHeroHovered||LEGACY_HERO_GALLERY.length<2)return;
    const timer=window.setInterval(()=>setCurrentHeroIndex(index=>(index+1)%LEGACY_HERO_GALLERY.length),6000);
    return()=>window.clearInterval(timer);
  },[isHeroHovered]);

  const paths=useMemo(()=>[...taxonomy.paths].sort((a,b)=>a.sortOrder-b.sortOrder),[taxonomy.paths]);
  const visiblePaths=paths.slice(0,6);
  const showcase=showcaseTab==='daylight'?PLATFORM_DAYLIGHT_IMAGES:PLATFORM_SHOWCASE_IMAGES;
  const dashboardHref=user?dashboardPathFor(user):'/dashboard';

  const learningPreviews=PLATFORM_DAYLIGHT_IMAGES.slice(1,4);

  return (
    <main data-testid="public-landing" dir="rtl" className="overflow-x-hidden bg-white font-tajawal text-gray-900">
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white pb-24 pt-12">
        <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
          <div className="legacy-blob absolute right-[-5%] top-[-10%] h-96 w-96 rounded-full bg-amber-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
          <div className="legacy-blob legacy-delay-2000 absolute left-[-10%] top-[20%] h-96 w-96 rounded-full bg-blue-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
          <div className="legacy-blob legacy-delay-4000 absolute bottom-[-10%] right-[20%] h-96 w-96 rounded-full bg-purple-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-10 lg:flex-row lg:gap-12">
            <div className="text-center lg:w-1/2 lg:text-right">
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-blue-100 bg-blue-50/90 px-4 py-2 text-xs font-black text-blue-600 shadow-sm backdrop-blur-sm sm:text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"/>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500"/>
                </span>
                <span>المنصة الأولى للقدرات والتحصيلي</span>
              </div>

              <h1 className="mb-6 text-4xl font-black leading-[1.18] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl xl:text-7xl">
                <span>حقق </span>
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">المئة</span>
                <br/>
                <span>في اختباراتك</span>
              </h1>

              <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl lg:mx-0">
                رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                {user ? (
                  <Link to={dashboardHref} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-amber-500 px-8 py-4 text-lg font-black text-white shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-1 hover:bg-amber-600 hover:shadow-xl hover:shadow-amber-500/35 active:scale-[0.98] sm:w-auto">
                    <Zap size={20} fill="currentColor"/> افتح لوحتك
                  </Link>
                ):(
                  <button type="button" onClick={()=>onAuth('signup')} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-amber-500 px-8 py-4 text-lg font-black text-white shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-1 hover:bg-amber-600 hover:shadow-xl hover:shadow-amber-500/35 active:scale-[0.98] sm:w-auto">
                    <Zap size={20} fill="currentColor"/> ابدأ التدريب مجانًا
                  </button>
                )}
                <Link to="/learning" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-8 py-4 text-lg font-bold text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 sm:w-auto">
                  <BookOpen size={20}/> تصفح مساحة التعلم
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-gray-500 sm:gap-6 lg:justify-start">
                <div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500"/><span>تعلّم حسب المسار</span></div>
                <div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-500"/><span>اختبارات ومراجعة</span></div>
                <div className="flex items-center gap-2"><Star size={18} className="fill-amber-500 text-amber-500"/><span>تجربة متكاملة</span></div>
              </div>
            </div>

            <div className="relative w-full lg:w-1/2">
              <div className="relative mx-auto w-full max-w-lg">
                <div
                  className="group relative aspect-[4/3] w-full select-none overflow-hidden rounded-3xl border-4 border-white bg-slate-900/5 shadow-2xl sm:aspect-[3/2]"
                  onMouseEnter={()=>setIsHeroHovered(true)}
                  onMouseLeave={()=>setIsHeroHovered(false)}
                >
                  {LEGACY_HERO_GALLERY.map((item,index)=>{
                    const active=index===currentHeroIndex%LEGACY_HERO_GALLERY.length;
                    return <img key={item.url} src={item.url} alt={item.alt} loading={index===0?'eager':'lazy'} className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-in-out ${active?'z-10 scale-100 opacity-100':'z-0 scale-105 opacity-0'}`}/>;
                  })}
                  <div className="absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/60 px-3 py-1 shadow-lg backdrop-blur-md">
                    {LEGACY_HERO_GALLERY.map((_,index)=>(
                      <button key={index} type="button" onClick={()=>setCurrentHeroIndex(index)} aria-label={`الصورة ${index+1}`} className={`rounded-full transition-all duration-300 ${index===currentHeroIndex?'h-1.5 w-6 bg-amber-400 shadow-sm':'h-1.5 w-1.5 bg-white/60 hover:bg-white'}`}/>
                    ))}
                  </div>
                  <button type="button" onClick={()=>setCurrentHeroIndex(index=>(index-1+LEGACY_HERO_GALLERY.length)%LEGACY_HERO_GALLERY.length)} aria-label="الصورة السابقة" className="absolute right-2.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/50 text-white opacity-0 shadow-md backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-slate-950/80"><ChevronRight size={16}/></button>
                  <button type="button" onClick={()=>setCurrentHeroIndex(index=>(index+1)%LEGACY_HERO_GALLERY.length)} aria-label="الصورة التالية" className="absolute left-2.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/50 text-white opacity-0 shadow-md backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-slate-950/80"><ChevronLeft size={16}/></button>
                </div>

                <div className="mt-3.5 flex items-center justify-center gap-2 overflow-x-auto px-1 pb-1">
                  {LEGACY_HERO_GALLERY.map((thumb,index)=>(
                    <button key={thumb.url} type="button" onClick={()=>setCurrentHeroIndex(index)} className={`relative h-[38px] w-[56px] shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 shadow-sm transition-all duration-300 ${index===currentHeroIndex?'scale-105 border-amber-500 ring-2 ring-amber-400/50':'border-white/90 bg-white opacity-70 hover:border-indigo-300 hover:opacity-100'}`}>
                      <img src={thumb.url} alt="" className="h-full w-full object-cover" loading="lazy"/>
                    </button>
                  ))}
                </div>

                <a href="#testimonials" className="legacy-float absolute -right-2 -top-3 z-20 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-3.5 py-2 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 sm:-right-4 sm:-top-5">
                  <div className="flex -space-x-2 space-x-reverse overflow-hidden">
                    {['99%','98%','97%'].map((value,index)=><div key={value} className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white ring-2 ring-white ${index===0?'bg-amber-500':index===1?'bg-indigo-600':'bg-emerald-600'}`}>{value}</div>)}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400"/><span className="text-xs font-black text-gray-900">قصص نجاح</span></div>
                    <div className="text-[10px] font-bold text-gray-500">شاهد تجارب الطلاب</div>
                  </div>
                </a>

                <a href="#paths" className="legacy-bounce absolute -bottom-4 right-2 z-20 block max-w-[195px] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 sm:-bottom-6 sm:-right-6 sm:max-w-[215px] sm:p-3.5">
                  <div className="mb-2 flex items-center gap-2.5 border-b border-gray-100 pb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm"><Target size={15}/></div>
                    <div className="min-w-0"><div className="truncate text-xs font-black text-gray-900">منصة المئة</div><div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"/>مسارات متكاملة</div></div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 p-0.5"><div className="h-full w-3/4 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"/></div>
                </a>

                <a href="#why-choose" className="legacy-float absolute left-2 top-10 z-20 flex items-center gap-1 rounded-2xl border-2 border-white bg-gradient-to-br from-amber-400 to-amber-500 p-2 text-white shadow-xl shadow-amber-500/20 transition-all duration-300 hover:scale-110 sm:-left-6 sm:top-14 sm:p-2.5"><span className="text-base font-black sm:text-lg">A+</span><Sparkles size={15} className="fill-amber-100 text-amber-100"/></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="إحصاءات المنصة" className="relative overflow-hidden border-y border-white/5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 py-5 text-white sm:py-6">
        <div className="absolute inset-0 opacity-15" style={{backgroundImage:'radial-gradient(#6366f1 1.5px, transparent 1.5px)',backgroundSize:'24px 24px'}}/>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              {value:String(paths.length),label:'مسار تعليمي',icon:<Target size={18} className="text-blue-400"/>},
              {value:String(taxonomy.subjects.length),label:'مادة مصنفة',icon:<BookOpen size={18} className="text-emerald-400"/>},
              {value:'تعلم',label:'دورات وتأسيس ومكتبة',icon:<Zap size={18} className="text-purple-400"/>},
              {value:'قياس',label:'اختبارات ومراجعة',icon:<Star size={18} className="text-amber-400"/>},
            ].map(item=>(
              <div key={item.label} className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.12] hover:shadow-xl sm:px-4 sm:py-3.5">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-sm transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10">{item.icon}</div>
                <div className="mb-0.5 text-xl font-black tracking-tight text-white transition-colors group-hover:text-amber-300 sm:text-2xl lg:text-3xl">{item.value}</div>
                <div className="text-[11px] font-bold text-indigo-200/90 sm:text-xs">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="paths" className="scroll-mt-20 bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-black text-gray-900 md:text-4xl">كل ما تحتاجه للتفوق</h2>
            <p className="mx-auto max-w-2xl text-gray-600">نقدم لك أدوات تعليمية متكاملة تغطي كافة جوانب التدريب والتقييم.</p>
          </div>
          {visiblePaths.length?(
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">{visiblePaths.map((path,index)=><OrganicPathCard key={path.id} path={path} index={index}/>)}</div>
          ):(
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {['القدرات العامة','التحصيلي العلمي','الاختبارات والمحاكاة'].map((name,index)=>(
                <div key={name} className="flex min-h-[176px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                  <div className="mb-3 rounded-2xl bg-indigo-50 p-3 text-indigo-600">{pathIcon(index)}</div>
                  <div className="text-lg font-black">{name}</div>
                  <div className="mt-2 text-xs font-bold text-slate-400">يتم تحميل التصنيف من المصدر الخادمي.</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-right"><h2 className="mb-2 text-3xl font-black text-gray-900 md:text-4xl">الدورات الأكثر طلبًا</h2><p className="text-gray-500">اختر دورتك وابدأ رحلة التفوق اليوم</p></div>
            <Link to="/learning" className="flex items-center gap-2 self-start font-bold text-indigo-600 hover:underline sm:self-auto">عرض الكل <ArrowDown size={16} className="rotate-90"/></Link>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {learningPreviews.map(item=>(
              <div key={item.id} className="group overflow-hidden rounded-3xl border border-gray-100 bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
                <div className="relative aspect-video overflow-hidden"><img src={item.url} alt={item.alt} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy"/><div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-black text-indigo-600 shadow-sm backdrop-blur-md">عرض تعريفي</div></div>
                <div className="p-6 text-right">
                  <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-1 text-amber-400"><Star size={14} fill="currentColor"/><span className="text-xs font-bold text-gray-600">منصة المئة</span></div><span className="text-[10px] font-bold text-gray-400">{item.badge}</span></div>
                  <h3 className="mb-2 font-bold text-gray-900 transition-colors group-hover:text-indigo-600">{item.title}</h3>
                  <p className="mb-4 line-clamp-2 text-xs leading-6 text-gray-500">{item.description}</p>
                  <div className="grid grid-cols-2 gap-2 border-t border-gray-50 pt-4">
                    <Link to={item.link} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 transition-all hover:bg-gray-50"><Eye size={15}/> معاينة</Link>
                    <Link to="/learning" className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white transition-all hover:bg-indigo-700"><ShoppingCart size={15}/> استكشف</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] font-bold text-slate-400">هذه بطاقات عرض للواجهة المرجعية؛ السعر والاستحقاق الفعليان يظلان من Commerce عند فتح رحلة الشراء.</p>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-right">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700"><BookOpen size={13}/><span>مقالات واستراتيجيات قياس</span></div>
              <h2 className="mb-2 text-3xl font-black text-gray-900 md:text-4xl">مقالات ومراجعات مهمة</h2>
              <p className="text-gray-500">مجموعة مبسطة من الشروحات النصية والمراجعات التي تساعدك على الفهم الأسرع.</p>
            </div>
            <Link to="/learning" className="group flex items-center gap-2 self-start font-black text-indigo-600 hover:underline sm:self-auto">استعرض مساحة التعلم <ArrowDown size={16} className="rotate-90 transition-transform group-hover:-translate-x-1"/></Link>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_PUBLIC_ARTICLES.map(article=>(
              <button key={article.id} type="button" onClick={()=>setSelectedArticle(article)} className="group h-full text-right">
                <div className="flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-indigo-300 group-hover:shadow-2xl">
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"><BookOpen size={12}/>{article.category}</span><span className="flex items-center gap-1 text-[11px] font-bold text-gray-400"><Clock size={12}/>{article.readTime}</span></div>
                    <h3 className="mb-3 line-clamp-2 text-lg font-black leading-8 text-gray-900 transition-colors group-hover:text-indigo-600">{article.title}</h3>
                    <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-600">{article.summary}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4"><div><span className="block text-xs font-black text-gray-800">{article.authorName}</span><span className="block text-[10px] text-gray-400">{article.authorRole}</span></div><span className="inline-flex items-center gap-1 text-xs font-black text-indigo-600">اقرأ الآن <ArrowLeft size={14}/></span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="why-choose" className="scroll-mt-20 overflow-hidden bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="text-right lg:w-5/12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-black text-amber-800"><Sparkles size={14} className="text-amber-500"/><span>تجربة تعليمية استثنائية متكاملة</span></div>
              <h2 className="mb-5 text-3xl font-black leading-tight text-gray-900 sm:text-4xl">لماذا يختار الطلاب منصة المئة؟</h2>
              <p className="mb-8 text-base leading-relaxed text-gray-600 sm:text-lg">نحن لا نقدم مجرد دورات، بل نقدم نظامًا تعليميًا متكاملًا يساعدك على الفهم العميق، التدريب المستمر، وتحليل الأداء بطريقة بسيطة وفعالة.</p>
              <div className="mb-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4"><div className="mb-0.5 text-xl font-black text-indigo-600 sm:text-2xl">تعلم مترابط</div><div className="text-xs font-bold text-gray-500">من المحتوى إلى القياس والمراجعة والخطة</div></div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4"><div className="mb-0.5 text-xl font-black text-emerald-600 sm:text-2xl">نطاق آمن</div><div className="text-xs font-bold text-gray-500">الصلاحيات والنتائج يقررها الخادم</div></div>
              </div>
              <ul className="mb-8 space-y-3.5">
                {['تحديث مستمر لبنوك الأسئلة والمحتوى المعتمد','مسارات تأسيس وتدريب ومحاكاة ومراجعة في منصة واحدة','واجهات متجاوبة للطالب والمدرسة وأولياء الأمور'].map(item=><li key={item} className="flex items-center gap-3"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={14}/></div><span className="text-sm font-bold text-gray-700">{item}</span></li>)}
              </ul>
              {user?<Link to={dashboardHref} className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-700">ابدأ رحلة التفوق الآن <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1"/></Link>:<button type="button" onClick={()=>onAuth('signup')} className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-700">ابدأ رحلة التفوق الآن <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1"/></button>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:w-7/12">
              <FeatureCard icon={<Video size={22} className="text-purple-600"/>} classes="bg-purple-100 border-purple-200" badge="تفاعلي" title="شرح مباشر وتفاعلي" description="حصص ومحتوى تفاعلي وخطوات تأسيس منهجية تناسب كافة المستويات."/>
              <FeatureCard icon={<Users size={22} className="text-blue-600"/>} classes="bg-blue-100 border-blue-200" badge="تعلم منظم" title="مسارات واضحة" description="مسارات ومادة وتأسيس ودورات مرتبة بحيث تصل لما تحتاجه بسرعة."/>
              <FeatureCard icon={<BarChart3 size={22} className="text-emerald-600"/>} classes="bg-emerald-100 border-emerald-200" badge="تحليل" title="تحليل الأداء" description="تقارير ومراجعة وخطوة تالية تساعدك على توجيه وقتك لمواضع الاحتياج."/>
              <FeatureCard icon={<ShoppingCart size={22} className="text-indigo-600"/>} classes="bg-indigo-100 border-indigo-200" badge="وصول خادمي" title="باقات ووصول واضح" description="الوصول والدفع والاشتراكات تبقى حقائق خادمية ولا تعتمد على إخفاء عناصر الواجهة."/>
              <FeatureCard icon={<Award size={22} className="text-cyan-600"/>} classes="bg-cyan-100 border-cyan-200" badge="مدارس" title="مدارس وفصول ذكية" description="مساحة عمل للمدارس والمعلمين والمشرفين مع فصل ذكي وتدخلات وتقارير."/>
              <FeatureCard icon={<Book size={22} className="text-amber-600"/>} classes="bg-amber-100 border-amber-200" badge="شاملة" title="ملفات ومراجعات" description="مكتبة وتأسيس ومراجعة تحفظ رحلة التعلم في مكان واحد."/>
            </div>
          </div>
        </div>
      </section>

      <section id="showcase-pillars" className="scroll-mt-20 overflow-hidden border-t border-slate-100 bg-gradient-to-b from-white via-indigo-50/30 to-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-black text-indigo-700"><Sparkles size={14} className="text-amber-500"/><span>رحلة التميز نحو الـ 100% في القياس والتحصيلي</span></div>
            <h2 className="mb-3 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">محطات التفوق الذكي في منصة المئة</h2>
            <p className="mx-auto mb-6 max-w-2xl text-base text-gray-600">منهجية متكاملة تبدأ من التأسيس النظري المتقن وتنتهي بتحقيق أعلى جاهزية ممكنة للاختبار.</p>
            <div className="inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5 shadow-inner">
              <button type="button" onClick={()=>setShowcaseTab('daylight')} className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition-all ${showcaseTab==='daylight'?'bg-white text-indigo-700 shadow-md ring-1 ring-indigo-100':'text-slate-600 hover:text-slate-900'}`}>☀️ استوديو المئة النهاري 3D <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600">{PLATFORM_DAYLIGHT_IMAGES.length}</span></button>
              <button type="button" onClick={()=>setShowcaseTab('neon')} className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition-all ${showcaseTab==='neon'?'bg-white text-indigo-700 shadow-md ring-1 ring-indigo-100':'text-slate-600 hover:text-slate-900'}`}>🌙 النمط السيبراني الليلي <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-600">{PLATFORM_SHOWCASE_IMAGES.length}</span></button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {showcase.map(item=>(
              <div key={item.id} className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
                <div className="relative aspect-[3/2] overflow-hidden bg-slate-900"><img src={item.url} alt={item.alt} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy"/><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"/><span className={`absolute right-3.5 top-3.5 rounded-full border px-3 py-1 text-xs font-black shadow-sm ${item.badgeColor}`}>{item.badge}</span></div>
                <div className="flex flex-1 flex-col justify-between p-6 text-right"><div><h3 className="mb-1.5 text-lg font-black text-slate-900 transition-colors group-hover:text-indigo-600">{item.title}</h3><div className="mb-3 text-xs font-bold text-amber-600">{item.subtitle}</div><p className="mb-5 text-xs leading-relaxed text-slate-600">{item.description}</p></div><Link to={item.link} className="inline-flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs font-black text-slate-800 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><span>{item.cta}</span><ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1"/></Link></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 py-20 text-white">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3.5 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-sm"><Sparkles size={14}/><span>تجارب تصنع الفارق</span></div><h2 className="mb-3 text-3xl font-black tracking-tight text-white sm:text-4xl">قصص نجاح نعتز بها</h2><p className="mx-auto max-w-2xl text-base text-indigo-200">انضم للطلاب الذين بنوا رحلة تدريب أكثر تنظيمًا معنا</p></div>
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">{DEFAULT_PUBLIC_TESTIMONIALS.map(item=><TestimonialCard key={item.id} {...item}/>)}</div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-amber-500/10 blur-3xl"/>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div><div className="text-2xl font-black"><span className="text-blue-300">منصة</span> <span className="text-amber-400">المئة</span></div><div className="mt-1 text-xs font-bold text-slate-400">قدرات & تحصيلي</div><p className="mt-4 text-sm font-medium leading-7 text-slate-400">رحلة تعلم وقياس ومراجعة للطلاب والمدارس، مبنية على واجهة منصة المئة التي تعرفها.</p></div>
          <div><h3 className="font-black text-white">روابط سريعة</h3><div className="mt-4 grid gap-3 text-sm font-bold text-slate-400"><Link to="/" className="hover:text-white">الرئيسية</Link><Link to="/learning" className="hover:text-white">مساحة التعلم</Link><Link to="/assessments" className="hover:text-white">الاختبارات</Link><Link to="/review" className="hover:text-white">المراجعة</Link></div></div>
          <div><h3 className="font-black text-white">عن المنصة</h3><div className="mt-4 grid gap-3 text-sm font-bold text-slate-400"><Link to="/about" className="hover:text-white">من نحن</Link><Link to="/faq" className="hover:text-white">الأسئلة الشائعة</Link><Link to="/contact" className="hover:text-white">تواصل معنا</Link></div></div>
          <div><h3 className="font-black text-white">السياسات</h3><div className="mt-4 grid gap-3 text-sm font-bold text-slate-400"><Link to="/privacy" className="hover:text-white">سياسة الخصوصية</Link><Link to="/terms" className="hover:text-white">الشروط والأحكام</Link></div></div>
        </div>
        <div className="border-t border-slate-800 px-4 py-5 text-center text-xs font-bold text-slate-500">منصة المئة للقدرات والتحصيلي</div>
      </footer>

      {selectedArticle?<ArticleModal article={selectedArticle} onClose={()=>setSelectedArticle(null)}/>:null}
    </main>
  );
}
