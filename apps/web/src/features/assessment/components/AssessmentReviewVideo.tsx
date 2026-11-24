import { X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef } from 'react';

const SharedVideoPlayer = lazy(async () => ({
  default: (await import('../../learning/components/SharedVideoPlayer')).SharedVideoPlayer,
}));

export function AssessmentReviewVideo({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      dir="rtl"
      aria-label={title}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <button
        type="button"
        autoFocus
        aria-label="إغلاق مشغل الفيديو"
        onClick={() => dialog.current?.close()}
        className="absolute left-3 top-3 z-50 rounded-full bg-white/95 p-2.5 text-gray-800 shadow-lg hover:text-red-600 focus-visible:ring-2 focus-visible:ring-indigo-600"
      >
        <X size={22} />
      </button>
      <div className="aspect-video bg-black">
        <Suspense fallback={<p role="status" className="grid h-full place-items-center text-sm font-bold text-white">جاري تجهيز المشغل...</p>}>
          <SharedVideoPlayer url={url} title={title} />
        </Suspense>
      </div>
      <p className="bg-gray-50 p-3 text-center text-xs text-gray-500 sm:p-4 sm:text-sm">شرح تفصيلي مقدم من منصة المئة التعليمية</p>
    </dialog>
  );
}
