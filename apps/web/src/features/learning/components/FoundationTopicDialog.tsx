import { ExternalLink, FileText, Lock, Target, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { contentClient } from '../../content/api/content-client';
import type { LearnerTopic, LearnerTopicSummary } from '../../content/api/content-types';

export type TopicContentTab = 'lessons' | 'quizzes' | 'support';

type Props = {
  topic: LearnerTopicSummary;
  topics: LearnerTopicSummary[];
  contentTab: TopicContentTab;
  onSelectTopic: (topicId: string) => void;
  onSelectContent: (tab: TopicContentTab) => void;
  onClose: () => void;
};

const contentTabs: Array<[TopicContentTab, string, typeof Video]> = [
  ['lessons', 'الشروحات', Video],
  ['quizzes', 'التدريبات القصيرة', Target],
  ['support', 'ملف الدعم', FileText],
];

export function FoundationTopicDialog({ topic, topics, contentTab, onSelectTopic, onSelectContent, onClose }: Props) {
  const [detail, setDetail] = useState<LearnerTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const root = topics.find((item) => item.id === topic.parentTopicId) || topic;
  const children = topics.filter((item) => item.parentTopicId === root.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const detailForTopic = detail?.id === topic.id ? detail : null;

  useEffect(() => {
    setDetail(null);
    setError('');
    if (topic.isLocked) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    contentClient.learnerTopic(topic.id, controller.signal)
      .then(({ topic: next }) => {
        if (!controller.signal.aborted) setDetail(next);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الموضوع');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [topic.id, topic.isLocked, retry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div data-testid="foundation-topic-dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl" role="dialog" aria-modal="true" aria-label={root.title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[90vh]">
        <header className="relative flex h-24 shrink-0 flex-col justify-between bg-gradient-to-l from-indigo-900 to-[#2e2b70] p-5 text-white sm:h-28 sm:p-6">
          <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute left-4 top-4 rounded-full p-2 hover:bg-white/10">
            <X size={22} />
          </button>
          <span className="text-xs font-bold text-indigo-200">التأسيس</span>
          <h2 className="text-xl font-black">{root.title}</h2>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-gray-100 bg-gray-50 md:max-h-none md:w-64 md:border-b-0 md:border-l">
            <h3 className="border-b border-gray-100 p-4 font-bold text-gray-800">الموضوعات الفرعية</h3>
            <div className="space-y-1 p-2">
              <button type="button" onClick={() => onSelectTopic(root.id)}
                className={`w-full rounded-xl border p-4 text-right font-bold ${topic.id === root.id ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-700 hover:bg-white'}`}>
                عام (للموضوع الرئيسي)
              </button>
              {children.map((child) => (
                <button type="button" key={child.id} onClick={() => onSelectTopic(child.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-right font-bold ${topic.id === child.id ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-700 hover:bg-white'}`}>
                  {child.title}{child.isLocked ? <Lock size={16} className="text-amber-600" /> : null}
                </button>
              ))}
            </div>
          </aside>
          <div className="flex min-h-0 flex-1 flex-col">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 px-3 sm:px-6" aria-label="محتوى الموضوع">
              {contentTabs.map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => onSelectContent(id)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-bold sm:px-6 ${contentTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  <Icon size={18} />{label}
                </button>
              ))}
            </nav>
            <section className="flex-1 overflow-y-auto p-4 sm:p-6">
              {topic.isLocked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-800">
                  <Lock className="mx-auto mb-3" size={26} />
                  هذا الموضوع ضمن باقة التأسيس
                </div>
              ) : loading ? (
                <p className="py-10 text-center font-bold text-gray-500">جاري تحميل المحتوى...</p>
              ) : error ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetry((value) => value + 1)}
                    className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">إعادة المحاولة</button>
                </div>
              ) : contentTab === 'lessons' ? (
                detailForTopic?.lessons.length ? (
                  <div className="space-y-4">
                    {detailForTopic.lessons.map((lesson) => (
                      <article key={lesson.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{lesson.title}</h3>
                          {lesson.description ? <p className="mt-1 text-sm text-gray-500">{lesson.description}</p> : null}
                        </div>
                        {lesson.isLocked || lesson.commerceLocked ? <Lock size={18} className="text-amber-600" aria-label="مقفل" /> : <Video size={18} className="text-indigo-600" />}
                      </article>
                    ))}
                  </div>
                ) : <p className="py-10 text-center text-gray-500">لا توجد شروحات لهذا الجزء بعد.</p>
              ) : contentTab === 'support' ? (
                detailForTopic?.libraryItems.length ? (
                  <div className="space-y-4">
                    {detailForTopic.libraryItems.map((item) => (
                      <article key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{item.title}</h3>
                          {item.description ? <p className="mt-1 text-sm text-gray-500">{item.description}</p> : null}
                        </div>
                        {item.isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            <Lock size={14} />
                            <span>ضمن الباقة</span>
                          </span>
                        ) : item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            <ExternalLink size={14} />
                            <span>فتح الملف</span>
                          </a>
                        ) : (
                          <FileText size={18} className="text-indigo-600" />
                        )}
                      </article>
                    ))}
                  </div>
                ) : <p className="py-10 text-center text-gray-500">لا يوجد ملف دعم لهذا الجزء بعد.</p>
              ) : (
                <p className="py-10 text-center text-gray-500">لا توجد تدريبات قصيرة لهذا الجزء بعد.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
