import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

export interface SharedVideoPlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  readonly currentTime: number;
  readonly duration: number;
}

export interface InteractiveQuestionItem {
  id: string;
  timestamp: number;
  text: string;
  options: string[];
  correctOptionIndex: number;
  imageUrl?: string;
  mustPass?: boolean;
  actionOnFail?: 'continue' | 'rewatch';
  rewatchTimestamp?: number;
}

export interface SharedVideoPlayerProps {
  url: string;
  title: string;
  initialPositionSeconds?: number;
  initialAnsweredQuestionIds?: string[];
  interactiveQuestions?: InteractiveQuestionItem[];
  onTimeUpdate?: (seconds: number, duration: number) => void;
  onPause?: (seconds: number) => void;
  onLoaded?: (duration: number) => void;
  onEnded?: () => void;
  onQuestionAnswered?: (questionId: string, isCorrect: boolean, allAnsweredIds: string[]) => void;
  requireControllable?: boolean;
}

type VideoSource = { kind: 'youtube'; id: string } | { kind: 'file' | 'iframe'; url: string };

export function resolveVideoSource(raw: string): VideoSource | null {
  try {
    let value = raw.trim();
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) value = new URL(value, window.location.origin).href;
    if (/^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(value)) value = `https://${value}`;
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be' || host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
      const id = host.endsWith('youtu.be') ? url.pathname.split('/')[1] : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { kind: 'youtube', id } : null;
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
      return match ? { kind: 'iframe', url: `https://player.vimeo.com/video/${match[1]}` } : null;
    }
    if (host === 'drive.google.com') {
      const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || (url.pathname === '/open' ? url.searchParams.get('id') : null);
      return id && /^[\w-]+$/.test(id) ? { kind: 'iframe', url: `https://drive.google.com/file/d/${id}/preview` } : null;
    }
    return { kind: 'file', url: url.href };
  } catch { return null; }
}

export const SharedVideoPlayer = forwardRef<SharedVideoPlayerHandle, SharedVideoPlayerProps>(function SharedVideoPlayer(
  {
    url,
    title,
    initialPositionSeconds = 0,
    initialAnsweredQuestionIds = [],
    interactiveQuestions = [],
    onTimeUpdate,
    onPause,
    onLoaded,
    onEnded,
    onQuestionAnswered,
    requireControllable = false,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const callbacks = useRef({ onTimeUpdate, onPause, onLoaded, onEnded, onQuestionAnswered });
  callbacks.current = { onTimeUpdate, onPause, onLoaded, onEnded, onQuestionAnswered };
  const initialRef = useRef(initialPositionSeconds);
  initialRef.current = initialPositionSeconds;
  const [error, setError] = useState('');

  // Interactive Question State
  const [activeQuestion, setActiveQuestion] = useState<InteractiveQuestionItem | null>(null);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set(initialAnsweredQuestionIds));
  useEffect(() => {
    if (initialAnsweredQuestionIds && initialAnsweredQuestionIds.length > 0) {
      setAnsweredQuestionIds(new Set(initialAnsweredQuestionIds));
    }
  }, [initialAnsweredQuestionIds]);
  const answeredQuestionIdsRef = useRef(answeredQuestionIds);
  answeredQuestionIdsRef.current = answeredQuestionIds;
  const questionsRef = useRef(interactiveQuestions);
  questionsRef.current = interactiveQuestions;

  useImperativeHandle(ref, () => ({
    play: () => { void playerRef.current?.play(); },
    pause: () => playerRef.current?.pause(),
    seek: (seconds) => { if (playerRef.current && Number.isFinite(seconds)) playerRef.current.currentTime = Math.max(0, seconds); },
    get currentTime() { return playerRef.current?.currentTime || 0; },
    get duration() { return playerRef.current?.duration || 0; },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    const source = resolveVideoSource(url);
    setError('');
    setActiveQuestion(null);
    if (!host || !source) { setError('تعذر فتح رابط الفيديو.'); return; }

    if (source.kind === 'iframe') {
      if (requireControllable) { setError('مصدر الفيديو لا يدعم الأسئلة التفاعلية الإلزامية.'); return; }
      const iframe = document.createElement('iframe');
      iframe.src = source.url;
      iframe.title = title || 'مشغل فيديو منصة المئة';
      iframe.className = 'h-full w-full';
      iframe.allow = 'encrypted-media; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      host.replaceChildren(iframe);
      return () => { host.replaceChildren(); };
    }

    const element = document.createElement(source.kind === 'youtube' ? 'div' : 'video');
    if (source.kind === 'youtube') {
      element.setAttribute('data-plyr-provider', 'youtube');
      element.setAttribute('data-plyr-embed-id', source.id);
    } else {
      const video = element as HTMLVideoElement;
      video.src = source.url;
      video.dataset.testid = 'lesson-video';
      video.playsInline = true;
      video.preload = 'metadata';
    }
    host.replaceChildren(element);

    let player: Plyr;
    try {
      player = new Plyr(element, {
        controls: [
          'restart',
          'rewind',
          'play',
          'fast-forward',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen',
        ],
        settings: ['speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
        seekTime: 10,
        autoplay: false,
        youtube: {
          noCookie: true,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
        },
      } as Plyr.Options);
    } catch {
      setError('تعذر تهيئة مشغل الفيديو.');
      return;
    }

    playerRef.current = player;

    player.once('ready', () => {
      if (Number.isFinite(initialRef.current) && initialRef.current > 0) {
        player.currentTime = initialRef.current;
      }
      callbacks.current.onLoaded?.(player.duration || 0);
    });

    player.on('timeupdate', () => {
      const currTime = player.currentTime || 0;
      callbacks.current.onTimeUpdate?.(currTime, player.duration || 0);

      // Check for interactive question
      if (!activeQuestion && questionsRef.current.length > 0) {
        const due = questionsRef.current.find(
          (q) => !answeredQuestionIdsRef.current.has(q.id) && currTime >= q.timestamp,
        );
        if (due) {
          player.pause();
          setActiveQuestion(due);
        }
      }
    });

    player.on('pause', () => callbacks.current.onPause?.(player.currentTime || 0));
    player.on('ended', () => callbacks.current.onEnded?.());
    player.on('error', () => setError('تعذر تشغيل الفيديو.'));

    return () => {
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [url, requireControllable]);

  const resolveQuestion = (isCorrect: boolean) => {
    if (!activeQuestion) return;
    const nextAnswered = new Set(answeredQuestionIds);
    if (isCorrect || !activeQuestion.mustPass) {
      nextAnswered.add(activeQuestion.id);
    }
    setAnsweredQuestionIds(nextAnswered);

    callbacks.current.onQuestionAnswered?.(activeQuestion.id, isCorrect, Array.from(nextAnswered));

    if (!isCorrect && activeQuestion.actionOnFail === 'rewatch') {
      const player = playerRef.current;
      if (player) {
        player.currentTime = Math.max(0, activeQuestion.rewatchTimestamp ?? (player.currentTime || 0) - 15);
      }
    }
    setActiveQuestion(null);
    void playerRef.current?.play();
  };

  return (
    <div
      className="almeaa-video-player group relative aspect-video w-full overflow-hidden rounded-3xl bg-black"
      dir="ltr"
      aria-label={title || 'مشغل فيديو منصة المئة'}
    >
      <div ref={hostRef} className="h-full w-full" />

      {/* YouTube Top Controls & Header Mask (1:1 with Legacy) */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[15] h-24 cursor-default bg-gradient-to-b from-black via-black/90 to-transparent" />

      {/* YouTube Bottom-Right Watermark Mask (1:1 with Legacy) */}
      <div className="pointer-events-none absolute bottom-12 right-0 z-[15] h-16 w-40 cursor-default bg-gradient-to-l from-black via-black/85 to-transparent" />

      {/* Canonical Floating Title Pill (1:1 with Legacy) */}
      {title ? (
        <div
          className="pointer-events-none absolute left-4 right-4 top-4 z-20 max-w-fit rounded-2xl border border-white/15 bg-slate-950/75 px-4 py-2 text-right text-xs sm:text-sm font-bold text-white shadow-xl backdrop-blur-md"
          dir="rtl"
        >
          {title}
        </div>
      ) : null}

      {/* Interactive Question Overlay (1:1 with Legacy) */}
      {activeQuestion ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6 text-right">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
              سؤال سريع داخل الدرس
            </div>
            {activeQuestion.imageUrl ? (
              <img
                src={activeQuestion.imageUrl}
                alt="صورة السؤال"
                className="mb-3 max-h-56 w-full rounded-xl border border-slate-200 bg-slate-50 p-1 object-contain"
              />
            ) : null}
            <div className="mb-4 text-base font-bold leading-8 text-slate-900 sm:text-lg">
              {activeQuestion.text}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeQuestion.options.map((option, index) => (
                <button
                  key={`${activeQuestion.id}-${index}`}
                  onClick={() => resolveQuestion(index === activeQuestion.correctOptionIndex)}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800 text-right"
                >
                  {option}
                </button>
              ))}
            </div>
            {!activeQuestion.mustPass ? (
              <button
                onClick={() => resolveQuestion(true)}
                className="mt-4 text-xs font-bold text-slate-500 transition hover:text-slate-800"
              >
                متابعة بدون إجابة الآن
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-slate-950 p-4 text-center text-sm font-bold text-white"
          dir="rtl"
        >
          {error}
        </p>
      ) : null}

      <style>{`
        .almeaa-video-player .plyr,
        .almeaa-video-player .plyr__video-wrapper {
          height: 100%;
          border-radius: 1.5rem;
        }
        .almeaa-video-player .plyr__video-embed iframe {
          pointer-events: none;
        }
        .almeaa-video-player .plyr {
          --plyr-color-main: #14b8a6;
        }
        .almeaa-video-player .plyr--full-ui input[type='range'] {
          color: #14b8a6;
        }
        .almeaa-video-player .plyr__control--overlaid,
        .almeaa-video-player .plyr--video .plyr__control:hover,
        .almeaa-video-player .plyr--video .plyr__control[aria-expanded='true'] {
          background: #14b8a6;
        }
      `}</style>
    </div>
  );
});
