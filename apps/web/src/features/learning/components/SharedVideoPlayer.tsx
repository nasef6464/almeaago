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

export interface SharedVideoPlayerProps {
  url: string;
  title: string;
  initialPositionSeconds?: number;
  onTimeUpdate?: (seconds: number, duration: number) => void;
  onPause?: (seconds: number) => void;
  onLoaded?: (duration: number) => void;
  onEnded?: () => void;
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
  { url, title, initialPositionSeconds = 0, onTimeUpdate, onPause, onLoaded, onEnded, requireControllable = false }, ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const callbacks = useRef({ onTimeUpdate, onPause, onLoaded, onEnded });
  callbacks.current = { onTimeUpdate, onPause, onLoaded, onEnded };
  const initialRef = useRef(initialPositionSeconds);
  initialRef.current = initialPositionSeconds;
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    play: () => { void playerRef.current?.play(); },
    pause: () => playerRef.current?.pause(),
    seek: seconds => { if (playerRef.current && Number.isFinite(seconds)) playerRef.current.currentTime = Math.max(0, seconds); },
    get currentTime() { return playerRef.current?.currentTime || 0; },
    get duration() { return playerRef.current?.duration || 0; },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    const source = resolveVideoSource(url);
    setError('');
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
        controls: ['restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
        settings: ['speed'], speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
        seekTime: 10, autoplay: false,
        youtube: { noCookie: true, controls: 0, rel: 0, playsinline: 1 },
      } as Plyr.Options);
    } catch { setError('تعذر تهيئة مشغل الفيديو.'); return; }
    playerRef.current = player;
    player.once('ready', () => {
      if (Number.isFinite(initialRef.current) && initialRef.current > 0) player.currentTime = initialRef.current;
      callbacks.current.onLoaded?.(player.duration || 0);
    });
    player.on('timeupdate', () => callbacks.current.onTimeUpdate?.(player.currentTime || 0, player.duration || 0));
    player.on('pause', () => callbacks.current.onPause?.(player.currentTime || 0));
    player.on('ended', () => callbacks.current.onEnded?.());
    player.on('error', () => setError('تعذر تشغيل الفيديو.'));
    return () => { player.destroy(); if (playerRef.current === player) playerRef.current = null; };
  }, [url, requireControllable]);

  return <div className="almeaa-video-player relative aspect-video w-full overflow-hidden rounded-3xl bg-black" dir="ltr" aria-label={title || 'مشغل فيديو منصة المئة'}>
    <div ref={hostRef} className="h-full w-full" />
    {error ? <p role="alert" className="absolute inset-0 flex items-center justify-center bg-slate-950 p-4 text-center text-sm font-bold text-white" dir="rtl">{error}</p> : null}
    <style>{`.almeaa-video-player .plyr,.almeaa-video-player .plyr__video-wrapper{height:100%}.almeaa-video-player .plyr{--plyr-color-main:#14b8a6}.almeaa-video-player .plyr__video-wrapper{border-radius:1.5rem}`}</style>
  </div>;
});
