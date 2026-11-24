import { useEffect, useRef, useState } from 'react';

import { contentClient } from '../../content/api/content-client';
import { AssessmentReviewVideo } from './AssessmentReviewVideo';

export function AssessmentFoundationVideoAction({ topicId, lessonId, skillName }: { topicId: string; lessonId: string; skillName: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoURL, setVideoURL] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => request.current?.abort(), []);

  async function open() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setLoading(true);
    try {
      const { lesson } = await contentClient.learnerFoundationLesson(topicId, lessonId, controller.signal);
      if (controller.signal.aborted) return;
      const url = lesson?.videoUrl?.trim();
      if (lesson?.id !== lessonId || lesson.type !== 'video' || !url) {
        setError('فيديو الشرح غير متاح لهذا الدرس.');
        return;
      }
      setVideoURL(url);
    } catch {
      if (!controller.signal.aborted) setError('تعذر فتح فيديو الشرح.');
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={() => void open()} disabled={loading}
        className="inline-flex rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 sm:text-sm">
        {loading ? 'جاري فتح الفيديو...' : 'شاهد الفيديو'}
      </button>
      {error && <p role="alert" className="w-full text-xs font-bold text-rose-700">{error}</p>}
      {videoURL && (
        <AssessmentReviewVideo url={videoURL} title={`شرح مهارة ${skillName}`} onClose={() => {
          setVideoURL('');
          trigger.current?.focus();
        }} />
      )}
    </>
  );
}
