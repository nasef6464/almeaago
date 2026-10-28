import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, FileText, GraduationCap, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from './Card';
import { useStudentExperience } from '../../../learning/navigation/StudentNavigationProvider';
import { usePublicArticles, type PublicArticleMetadata as Lesson } from './public-metadata';
import { sanitizeArabicText } from './sanitizeArabicText';
import { DEFAULT_PLATFORM_ARTICLES, type PlatformArticle } from './defaultArticles';
import { ArticleReaderModal } from './ArticleReaderModal';

type BlogFilter = 'all' | string;

interface BlogEntry {
    id: string;
    title: string;
    summary: string;
    pathId?: string;
    pathName: string;
    subjectId?: string;
    subjectName: string;
    typeLabel: string;
    dateLabel: string;
    actionLink: string;
    actionLabel: string;
    rawArticle?: PlatformArticle;
}

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';

const plainSummary = (value?: string | null) =>
    displayText(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const formatDateLabel = (timestamp?: number) => {
    if (!timestamp) return 'محتوى حديث';

    try {
        return new Intl.DateTimeFormat('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(new Date(timestamp));
    } catch {
        return 'محتوى حديث';
    }
};

export const BlogPage: React.FC = () => {
    const [filter, setFilter] = useState<BlogFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<PlatformArticle | null>(null);
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const {paths,subjects,user,loading:pathsLoading,error:pathsError} = useStudentExperience();
    const catalog = usePublicArticles();
    const lessons = catalog.items;

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(String(user.role));
    const visiblePathIds = useMemo(
        () => new Set(paths.filter((path) => canSeeHiddenPaths || path.isActive !== false).map((path) => path.id)),
        [canSeeHiddenPaths, paths],
    );

    const blogEntries = useMemo<BlogEntry[]>(() => {
        const publicTextLessons = lessons
            .filter((lesson) => {
                const isPublished = lesson.approvalStatus !== 'pending_review' && lesson.approvalStatus !== 'rejected';
                // Content owns the text/content predicate and public read guards.
                const hasArticleContent = true;
                const isVisiblePath = !lesson.pathId || visiblePathIds.has(lesson.pathId);

                return isPublished && hasArticleContent && lesson.showOnPlatform !== false && isVisiblePath;
            })
            .map((lesson: Lesson) => {
                const path = paths.find((item) => item.id === lesson.pathId);
                const subject = subjects.find((item) => item.id === lesson.subjectId);
                const hasLearningSpace = Boolean(lesson.pathId && lesson.subjectId);

                return {
                    id: `lesson-${lesson.id}`,
                    title: displayText(lesson.title) || 'شرح تعليمي',
                    summary:
                        plainSummary(lesson.description).slice(0, 220) ||
                        'مقالة تعليمية مرتبطة مباشرة بمسار الطالب داخل المنصة.',
                    pathId: lesson.pathId,
                    pathName: displayText(path?.name) || 'مسار عام',
                    subjectId: lesson.subjectId,
                    subjectName: displayText(subject?.name || path?.name) || 'عام',
                    typeLabel: lesson.type === 'text' ? 'مقالة تعليمية' : 'شرح نصي',
                    dateLabel: formatDateLabel(lesson.approvedAt),
                    actionLink: hasLearningSpace ? `/category/${lesson.pathId}?subject=${lesson.subjectId}&tab=skills` : '/courses',
                    actionLabel: hasLearningSpace ? 'افتح مساحة التعلم' : 'استعرض الدورات',
                };
            });

        if (publicTextLessons.length > 0) {
            return publicTextLessons.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
        }

        return DEFAULT_PLATFORM_ARTICLES.map((article) => ({
            id: article.id,
            title: article.title,
            summary: article.summary,
            pathId: article.trackId,
            pathName: article.category,
            subjectId: article.trackId,
            subjectName: article.tags.join(' • '),
            typeLabel: 'مقالة معتمدة',
            dateLabel: article.date,
            actionLink: '#',
            actionLabel: 'اقرأ المقال الآن',
            rawArticle: article,
        }));
    }, [lessons, paths, subjects, visiblePathIds]);

    const availableFilters = useMemo(() => {
        const names = new Set<string>();
        blogEntries.forEach((entry) => {
            if (entry.subjectName.trim()) names.add(entry.subjectName.trim());
        });

        return ['الكل', ...Array.from(names).slice(0, 8)];
    }, [blogEntries]);

    const filteredEntries = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return blogEntries.filter((entry) => {
            const matchesFilter = filter === 'all' || entry.subjectName === filter;
            const matchesQuery =
                !normalizedQuery ||
                entry.title.toLowerCase().includes(normalizedQuery) ||
                entry.summary.toLowerCase().includes(normalizedQuery) ||
                entry.subjectName.toLowerCase().includes(normalizedQuery) ||
                entry.pathName.toLowerCase().includes(normalizedQuery);

            return matchesFilter && matchesQuery;
        });
    }, [blogEntries, filter, searchQuery]);

    if(pathsLoading || catalog.loading) return <div role="status" className="p-8 text-center">جاري تحميل المقالات...</div>;
    if(pathsError || catalog.error) return <div role="alert" className="p-8 text-center"><p>{pathsError || catalog.error}</p><button type="button" onClick={()=>pathsError?window.location.reload():catalog.reload()} className="mt-3 rounded-xl border px-4 py-2">إعادة المحاولة</button></div>;
    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                    <Link to="/" className="text-gray-500 hover:text-gray-700">
                        <ArrowRight size={24} />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-amber-600 leading-tight">المدونة التعليمية</h1>
                        <p className="text-sm text-gray-500">
                            مقالات وشروحات ونبض المحتوى المنشور داخل المنصة في مكان واحد.
                        </p>
                    </div>
                </div>
                <Link
                    to="/courses"
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md w-full sm:w-auto"
                >
                    <GraduationCap size={18} />
                    <span className="hidden md:inline">انتقل إلى الدورات</span>
                    <span className="md:hidden">الدورات</span>
                </Link>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-4 border border-amber-100 bg-amber-50">
                    <div className="text-2xl font-black text-amber-600">{blogEntries.length}</div>
                    <div className="text-sm text-gray-600 font-bold">إجمالي المواد المقالية والشروحات النصية</div>
                </Card>
                <Card className="p-4 border border-blue-100 bg-blue-50">
                    <div className="text-2xl font-black text-blue-600">{availableFilters.length - 1}</div>
                    <div className="text-sm text-gray-600 font-bold">مواد تعليمية ممثلة داخل المدونة</div>
                </Card>
                <Card className="p-4 border border-emerald-100 bg-emerald-50">
                    <div className="text-2xl font-black text-emerald-600">
                        {new Set(blogEntries.map((entry) => entry.pathName)).size}
                    </div>
                    <div className="text-sm text-gray-600 font-bold">مسارات يظهر منها محتوى منشور</div>
                </Card>
            </div>

            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    aria-label="بحث في المقالات"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="ابحث في عناوين المقالات أو المواد..."
                    className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {availableFilters.map((label) => {
                    const isActive = (filter === 'all' && label === 'الكل') || filter === label;

                    return (
                        <button
                            key={label}
                            onClick={() => setFilter(label === 'الكل' ? 'all' : label)}
                            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredEntries.map((entry) => (
                    <Card key={entry.id} className="p-5 hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-4 mb-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                                        <BookOpen size={14} />
                                        {entry.pathName}
                                    </span>
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                                        <FileText size={14} />
                                        {entry.typeLabel}
                                    </span>
                                </div>
                                <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 leading-7 break-words">
                                    {entry.title}
                                </h3>
                                <p className="text-gray-500 text-sm leading-6 line-clamp-3">{entry.summary}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                                <span>{entry.subjectName}</span>
                                <span className="flex items-center gap-1">
                                    <CalendarDays size={14} />
                                    {entry.dateLabel}
                                </span>
                            </div>
                            {entry.rawArticle ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedArticle(entry.rawArticle || null);
                                        setIsArticleModalOpen(true);
                                    }}
                                    aria-label={`قراءة المقال ${entry.title}`}
                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors w-full sm:w-auto text-right sm:text-left cursor-pointer"
                                >
                                    {entry.actionLabel}
                                </button>
                            ) : (
                                <Link
                                    to={entry.actionLink}
                                    aria-label={`فتح المقال ${entry.title}`}
                                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 w-full sm:w-auto"
                                >
                                    {entry.actionLabel}
                                </Link>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {filteredEntries.length === 0 && (
                <Card className="p-12 text-center border-dashed border-2 border-gray-200">
                    <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-4">
                        <FileText size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">لا يوجد محتوى مطابق الآن</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        إمّا أن المدونة ما زالت تنتظر محتوى نصيًا معتمدًا، أو أن نتائج البحث الحالية لا تطابق البيانات المنشورة.
                    </p>
                    <Link to="/courses" className="text-indigo-600 font-bold hover:underline">
                        استعرض الدورات المنشورة
                    </Link>
                </Card>
            )}

            <ArticleReaderModal
                article={selectedArticle}
                isOpen={isArticleModalOpen}
                onClose={() => setIsArticleModalOpen(false)}
            />
        </div>
    );
};

export default BlogPage;
