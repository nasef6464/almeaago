import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { normalizeQuestionHtml } from '../../../lib/questionHtml';

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

type VideoSource =
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; url: string }
  | { kind: 'drive'; url: string }
  | { kind: 'file'; url: string };

export function resolveVideoSource(raw: string): VideoSource | null {
  try {
    let value = (raw || '').trim().replace(/^['"]|['"]$/g, '');
    if (!value) return null;

    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
      value = new URL(value, window.location.origin).href;
    }
    if (/^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(value)) {
      value = `https://${value}`;
    }

    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();

    // 1. YouTube
    if (
      host === 'youtu.be' ||
      host === 'www.youtu.be' ||
      host.includes('youtube.com') ||
      host.includes('youtube-nocookie.com')
    ) {
      let id = '';
      if (host.endsWith('youtu.be')) {
        id = url.pathname.split('/').filter(Boolean)[0] || '';
      } else {
        id =
          url.searchParams.get('v') ||
          url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
          '';
      }
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { kind: 'youtube', id } : null;
    }

    // 2. Vimeo
    if (host.includes('vimeo.com')) {
      const match = url.pathname.match(/(?:\/video\/|\/)(\d+)/);
      if (match && match[1]) {
        return { kind: 'vimeo', url: `https://player.vimeo.com/video/${match[1]}` };
      }
    }

    // 3. Google Drive
    if (host === 'drive.google.com') {
      const id =
        url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ||
        (url.pathname === '/open' ? url.searchParams.get('id') : null);
      if (id && /^[\w-]+$/.test(id)) {
        return { kind: 'drive', url: `https://drive.google.com/file/d/${id}/preview` };
      }
    }

    // 4. Dropbox
    if (host.includes('dropbox.com')) {
      url.searchParams.set('raw', '1');
      url.searchParams.delete('dl');
      return { kind: 'file', url: url.toString() };
    }

    // 5. Direct Media / R2 file
    return { kind: 'file', url: url.href };
  } catch {
    return null;
  }
}

export const SharedVideoPlayer = forwardRef<SharedVideoPlayerHandle, SharedVideoPlayerProps>(
  function SharedVideoPlayer(
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
    const containerRef = useRef<HTMLDivElement>(null);

    const callbacks = useRef({ onTimeUpdate, onPause, onLoaded, onEnded, onQuestionAnswered });
    callbacks.current = { onTimeUpdate, onPause, onLoaded, onEnded, onQuestionAnswered };

    const initialRef = useRef(initialPositionSeconds);
    initialRef.current = initialPositionSeconds;

    const [error, setError] = useState('');
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    // Interactive Question State
    const [activeQuestion, setActiveQuestion] = useState<InteractiveQuestionItem | null>(null);
    const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(
      () => new Set(initialAnsweredQuestionIds || []),
    );
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
    const [rewatchCountdown, setRewatchCountdown] = useState<number | null>(null);

    useEffect(() => {
      if (initialAnsweredQuestionIds && initialAnsweredQuestionIds.length > 0) {
        setAnsweredQuestionIds(new Set(initialAnsweredQuestionIds));
      }
    }, [initialAnsweredQuestionIds]);

    const answeredQuestionIdsRef = useRef(answeredQuestionIds);
    answeredQuestionIdsRef.current = answeredQuestionIds;

    const questionsRef = useRef(interactiveQuestions);
    questionsRef.current = interactiveQuestions;

    const activeQuestionRef = useRef<InteractiveQuestionItem | null>(null);
    activeQuestionRef.current = activeQuestion;

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          void playerRef.current?.play();
        },
        pause: () => playerRef.current?.pause(),
        seek: (seconds) => {
          if (playerRef.current && Number.isFinite(seconds)) {
            playerRef.current.currentTime = Math.max(0, seconds);
          }
        },
        get currentTime() {
          return playerRef.current?.currentTime || 0;
        },
        get duration() {
          return playerRef.current?.duration || 0;
        },
      }),
      [],
    );

    // Timeline Markers: Percentages where questions appear
    const questionMarkers = useMemo(() => {
      if (duration <= 0 || !interactiveQuestions || interactiveQuestions.length === 0) return [];
      return interactiveQuestions.map((q) => ({
        id: q.id,
        percent: Math.min(100, Math.max(0, (q.timestamp / duration) * 100)),
        mustPass: q.mustPass,
        isAnswered: answeredQuestionIds.has(q.id),
      }));
    }, [duration, interactiveQuestions, answeredQuestionIds]);

    // Setup Video Player
    useEffect(() => {
      const host = hostRef.current;
      const source = resolveVideoSource(url);
      setError('');
      setActiveQuestion(null);
      setSelectedOptionIndex(null);
      setFeedback(null);
      setRewatchCountdown(null);

      if (!host || !source) {
        setError('تعذر فتح رابط الفيديو. يرجى التحقق من صحة الرابط.');
        return;
      }

      // If iframe provider (Vimeo / Google Drive) and lesson strictly requires mustPass control
      if ((source.kind === 'vimeo' || source.kind === 'drive') && requireControllable) {
        setError(
          'هذا المصدر (Iframe) لا يدعم التحكم الإلزامي بالأسئلة التفاعلية ومواضع المشاهدة. يرجى استخدام YouTube أو رفع ملف فيديو مباشر.',
        );
        return;
      }

      // If generic iframe preview (e.g. Google Drive / Vimeo without mustPass)
      if (source.kind === 'vimeo' || source.kind === 'drive') {
        const iframe = document.createElement('iframe');
        iframe.src = source.url;
        iframe.title = title || 'مشغل منصة المئة';
        iframe.className = 'h-full w-full border-0';
        iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        host.replaceChildren(iframe);
        return () => {
          host.replaceChildren();
        };
      }

      // Plyr initialization for YouTube & direct Video files
      const element = document.createElement(source.kind === 'youtube' ? 'div' : 'video');
      if (source.kind === 'youtube') {
        element.setAttribute('data-plyr-provider', 'youtube');
        element.setAttribute('data-plyr-embed-id', source.id);
      } else {
        const video = element as HTMLVideoElement;
        video.src = source.url;
        video.dataset.testid = 'lesson-video';
        video.setAttribute('data-testid', 'lesson-video');
        video.playsInline = true;
        video.preload = 'metadata';
        video.controls = false;
        video.setAttribute('controlsList', 'nodownload');
      }
      host.replaceChildren(element);

      let player: Plyr;
      try {
        player = new Plyr(element, {
          controls: [
            'play-large',
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
          fullscreen: { enabled: true, fallback: true, iosNative: false },
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
        const initialDuration = Number(player.duration || 0);
        if (initialDuration > 0) {
          setDuration(initialDuration);
          callbacks.current.onLoaded?.(initialDuration);
        }
      });

      player.on('timeupdate', () => {
        const currTime = Number(player.currentTime || 0);
        setCurrentTime(currTime);

        const currentDuration = Number(player.duration || 0);
        if (currentDuration > 0 && currentDuration !== duration) {
          setDuration(currentDuration);
        }

        callbacks.current.onTimeUpdate?.(currTime, currentDuration);

        // Check for Due Interactive Question (Codax Contract)
        if (!activeQuestionRef.current && questionsRef.current.length > 0) {
          const due = questionsRef.current
            .filter(
              (q) =>
                !answeredQuestionIdsRef.current.has(q.id) &&
                currTime >= q.timestamp,
            )
            .sort((a, b) => a.timestamp - b.timestamp)[0];

          if (due) {
            player.pause();
            setActiveQuestion(due);
            setSelectedOptionIndex(null);
            setFeedback(null);
            setRewatchCountdown(null);
          }
        }
      });

      player.on('pause', () => callbacks.current.onPause?.(player.currentTime || 0));
      player.on('ended', () => callbacks.current.onEnded?.());
      player.on('error', () => setError('تعذر تشغيل الفيديو. يرجى التأكد من الرابط وصلاحية المصدر.'));

      return () => {
        try {
          player.destroy();
        } catch {}
        if (playerRef.current === player) playerRef.current = null;
      };
    }, [url, requireControllable]);

    // Handle Option Selection
    const handleSelectOption = (idx: number) => {
      if (!activeQuestion || feedback?.isCorrect) return;

      setSelectedOptionIndex(idx);
      const isCorrect = idx === activeQuestion.correctOptionIndex;

      if (isCorrect) {
        setFeedback({
          isCorrect: true,
          message: 'أحسنت! إجابة صحيحة وممتازة.',
        });

        // Add to answered IDs
        const nextAnswered = new Set(answeredQuestionIdsRef.current).add(activeQuestion.id);
        setAnsweredQuestionIds(nextAnswered);
        answeredQuestionIdsRef.current = nextAnswered;
        callbacks.current.onQuestionAnswered?.(
          activeQuestion.id,
          true,
          Array.from(nextAnswered),
        );

        // Resume after short celebratory moment
        setTimeout(() => {
          setActiveQuestion(null);
          setSelectedOptionIndex(null);
          setFeedback(null);
          void playerRef.current?.play();
        }, 1300);
      } else {
        // Wrong Answer
        if (activeQuestion.actionOnFail === 'rewatch') {
          const rewatchTimestamp = Math.max(
            0,
            activeQuestion.rewatchTimestamp ?? (playerRef.current?.currentTime || 15) - 15,
          );
          const rewatchMin = Math.floor(rewatchTimestamp / 60);
          const rewatchSec = String(rewatchTimestamp % 60).padStart(2, '0');

          setFeedback({
            isCorrect: false,
            message: `إجابة غير صحيحة. سيتم الرجوع إلى الدقيقة ${rewatchMin}:${rewatchSec} لمراجعة الشرح وفهم المفهوم جيدًا.`,
          });
          setRewatchCountdown(2);

          setTimeout(() => {
            if (playerRef.current) {
              playerRef.current.currentTime = rewatchTimestamp;
            }
            setActiveQuestion(null);
            setSelectedOptionIndex(null);
            setFeedback(null);
            setRewatchCountdown(null);
            void playerRef.current?.play();
          }, 2200);
        } else {
          // Continue on fail
          setFeedback({
            isCorrect: false,
            message: activeQuestion.mustPass
              ? 'إجابة غير صحيحة. هذا السؤال إلزامي ويجب الإجابة عليه بصورة صحيحة للمتابعة.'
              : 'إجابة غير صحيحة. يمكنك إعادة المحاولة أو المتابعة.',
          });

          // If not mustPass, user can still proceed
          if (!activeQuestion.mustPass) {
            const nextAnswered = new Set(answeredQuestionIdsRef.current).add(activeQuestion.id);
            setAnsweredQuestionIds(nextAnswered);
            answeredQuestionIdsRef.current = nextAnswered;
            callbacks.current.onQuestionAnswered?.(
              activeQuestion.id,
              false,
              Array.from(nextAnswered),
            );
          }
        }
      }
    };

    // Skip question (Allowed only when mustPass is false)
    const handleSkip = () => {
      if (!activeQuestion || activeQuestion.mustPass) return;

      const nextAnswered = new Set(answeredQuestionIdsRef.current).add(activeQuestion.id);
      setAnsweredQuestionIds(nextAnswered);
      answeredQuestionIdsRef.current = nextAnswered;
      callbacks.current.onQuestionAnswered?.(
        activeQuestion.id,
        true,
        Array.from(nextAnswered),
      );

      setActiveQuestion(null);
      setSelectedOptionIndex(null);
      setFeedback(null);
      void playerRef.current?.play();
    };

    // Keyboard Shortcuts (Space for pause/play, Arrows for seek)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Do not intercept if focus is inside an input or if active question is showing
        if (
          activeQuestion ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
        ) {
          return;
        }

        const player = playerRef.current;
        if (!player) return;

        if (e.code === 'Space') {
          e.preventDefault();
          if (player.paused) void player.play();
          else player.pause();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          player.currentTime = Math.min(player.duration || 0, (player.currentTime || 0) + 10);
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          player.currentTime = Math.max(0, (player.currentTime || 0) - 10);
        } else if (e.key === 'm' || e.key === 'M' || e.key === 'ة') {
          player.muted = !player.muted;
        } else if (e.key === 'f' || e.key === 'F' || e.key === 'ب') {
          player.fullscreen.toggle();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeQuestion]);

    return (
      <div
        ref={containerRef}
        className="almeaa-video-player group relative aspect-video w-full overflow-hidden rounded-3xl bg-black"
        dir="ltr"
        aria-label={title || 'مشغل فيديو منصة المئة'}
      >
        <div ref={hostRef} className="h-full w-full" />

        {/* YouTube Top Controls & Header Mask (1:1 with Legacy) */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[15] h-24 cursor-default bg-gradient-to-b from-black via-black/90 to-transparent" />

        {/* YouTube Bottom-Right Watermark Mask (1:1 with Legacy) */}
        <div className="pointer-events-none absolute bottom-12 right-0 z-[15] h-16 w-40 cursor-default bg-gradient-to-l from-black via-black/85 to-transparent" />

        {/* Canonical Floating Title Pill */}
        {title ? (
          <div
            className="pointer-events-none absolute left-4 right-4 top-4 z-20 max-w-fit rounded-2xl border border-white/15 bg-slate-950/75 px-4 py-2 text-right text-xs sm:text-sm font-bold text-white shadow-xl backdrop-blur-md"
            dir="rtl"
          >
            {title}
          </div>
        ) : null}

        {/* Interactive Question Overlay */}
        {activeQuestion ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md animate-fadeIn"
            dir="rtl"
          >
            <div className="w-full max-w-2xl rounded-3xl border border-indigo-200/40 bg-white p-5 shadow-2xl sm:p-7 text-right dark:border-slate-700 dark:bg-slate-900">
              {/* Header Badge & Time */}
              <div className="mb-3.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <HelpCircle size={15} />
                  سؤال تفاعلي أثناء الدرس
                </span>
                <div className="flex items-center gap-2">
                  {activeQuestion.mustPass ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                      إلزامي للمتابعة
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      اختياري
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {Math.floor(activeQuestion.timestamp / 60)}:
                    {String(activeQuestion.timestamp % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Optional Question Image */}
              {activeQuestion.imageUrl ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center dark:border-slate-800 dark:bg-slate-950">
                  <img
                    src={activeQuestion.imageUrl}
                    alt="صورة توضيحية للسؤال"
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              ) : null}

              {/* Question Text with KaTeX Math rendering */}
              <div
                className="question-html mb-5 text-base font-bold leading-relaxed text-slate-900 sm:text-lg dark:text-white"
                dangerouslySetInnerHTML={{
                  __html: normalizeQuestionHtml(activeQuestion.text),
                }}
              />

              {/* Options Grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {activeQuestion.options.map((option, idx) => {
                  const isSelected = selectedOptionIndex === idx;
                  const isCorrect = idx === activeQuestion.correctOptionIndex;

                  let optionStyle =
                    'border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/70 hover:text-indigo-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200';

                  if (selectedOptionIndex !== null) {
                    if (isSelected && isCorrect) {
                      optionStyle =
                        'border-emerald-500 bg-emerald-50 text-emerald-900 font-black shadow-xs dark:bg-emerald-950/60 dark:text-emerald-200';
                    } else if (isSelected && !isCorrect) {
                      optionStyle =
                        'border-rose-500 bg-rose-50 text-rose-900 font-black shadow-xs dark:bg-rose-950/60 dark:text-rose-200';
                    } else if (!isSelected && isCorrect && feedback?.isCorrect === false) {
                      // Highlight correct answer if failed
                      optionStyle =
                        'border-emerald-300 bg-emerald-50/40 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300';
                    }
                  }

                  return (
                    <button
                      key={`${activeQuestion.id}-${idx}`}
                      type="button"
                      disabled={Boolean(feedback?.isCorrect)}
                      onClick={() => handleSelectOption(idx)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right text-sm font-bold transition-all cursor-pointer ${optionStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200/60 text-xs font-black text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {['أ', 'ب', 'ج', 'د', 'هـ'][idx] || idx + 1}
                        </span>
                        <span
                          className="question-html"
                          dangerouslySetInnerHTML={{
                            __html: normalizeQuestionHtml(option),
                          }}
                        />
                      </div>
                      {isSelected && isCorrect ? (
                        <CheckCircle2 size={19} className="shrink-0 text-emerald-600" />
                      ) : null}
                      {isSelected && !isCorrect ? (
                        <X size={19} className="shrink-0 text-rose-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Alert */}
              {feedback ? (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-2xl p-3.5 text-xs font-bold leading-6 animate-fadeIn ${
                    feedback.isCorrect
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  {feedback.isCorrect ? (
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                  ) : (
                    <RotateCcw size={18} className="shrink-0 text-rose-600" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              ) : null}

              {/* Skip Button (For optional questions only) */}
              {!activeQuestion.mustPass && !feedback?.isCorrect ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-xs font-bold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  >
                    متابعة بدون إجابة الآن
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Error Fallback Overlay */}
        {error ? (
          <div
            role="alert"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white"
            dir="rtl"
          >
            <p className="text-base font-black">{error}</p>
            <p className="max-w-md text-xs font-medium text-slate-400">
              تأكد من إعدادات المشغل أو الرابط المرفق لهذا الدرس في لوحة المحتوى.
            </p>
          </div>
        ) : null}

        {/* Plyr & Custom Theme Styling */}
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
  },
);
