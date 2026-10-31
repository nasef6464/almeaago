import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { useAuth } from '../auth/state/AuthProvider';
import type { AnnouncementAd } from './announcement-types';
import { useAnnouncementAds } from './useAnnouncementAds';

const SESSION_DISMISSED_KEY = 'almeaa-dismissed-announcement-ads';
const PERMANENT_DISMISSED_KEY = 'almeaa-dismissed-announcement-ads-once';
export const ANNOUNCEMENT_AD_PREVIEW_EVENT = 'almeaa-announcement-ad-preview';

const getDismissedIds = (storage: Storage, key: string) => {
  try {
    return new Set(JSON.parse(storage.getItem(key) || '[]') as string[]);
  } catch {
    return new Set<string>();
  }
};

const dismissIds = (ids: string[], frequency: AnnouncementAd['frequency'] = 'session') => {
  if (frequency === 'always') return;
  try {
    const storage = frequency === 'once' ? localStorage : sessionStorage;
    const key = frequency === 'once' ? PERMANENT_DISMISSED_KEY : SESSION_DISMISSED_KEY;
    const nextIds = new Set([...getDismissedIds(storage, key), ...ids]);
    storage.setItem(key, JSON.stringify([...nextIds]));
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }
};

const isDismissed = (ad: AnnouncementAd) => {
  if (ad.frequency === 'always') return false;
  const sessionDismissed = getDismissedIds(sessionStorage, SESSION_DISMISSED_KEY);
  const permanentDismissed = getDismissedIds(localStorage, PERMANENT_DISMISSED_KEY);
  return sessionDismissed.has(ad.id) || permanentDismissed.has(ad.id);
};

const isLiveNow = (ad: AnnouncementAd) => {
  const now = Date.now();
  return ad.isActive && (!ad.startsAt || ad.startsAt <= now) && (!ad.endsAt || ad.endsAt >= now);
};

export const AnnouncementAdsOverlay: React.FC = () => {
  const { user } = useAuth();
  const { ads } = useAnnouncementAds();
  const navigate = useNavigate();
  const location = useLocation();

  const isExcluded = location.pathname.startsWith('/admin-dashboard') || location.pathname.startsWith('/login') || location.pathname.endsWith('/projector');

  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0);
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [canShowDelayed, setCanShowDelayed] = useState(false);
  const [previewAdId, setPreviewAdId] = useState<string | null>(null);

  const matchesAudience = (ad: AnnouncementAd) => {
    if (ad.audience === 'all') return true;
    if (ad.audience === 'guest') return !user;
    if (ad.audience === 'student') return user?.roles.includes('student');
    if (ad.audience === 'parent') return user?.roles.includes('parent');
    if (ad.audience === 'staff') return user?.roles.some((r) => ['admin', 'teacher', 'supervisor'].includes(r));
    return true;
  };

  const visibleAds = useMemo(() => {
    return ads
      .filter((ad) => {
        if (!ad.id) return false;
        if (previewAdId === ad.id) return true;
        return !isDismissed(ad) && isLiveNow(ad) && matchesAudience(ad);
      })
      .sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt);
  }, [ads, dismissedVersion, previewAdId, user]);

  const activeIndex = Math.min(index, Math.max(visibleAds.length - 1, 0));
  const activeAd = visibleAds[activeIndex];

  useEffect(() => {
    setCanShowDelayed(false);
    if (!activeAd) return;

    const delayMs = previewAdId === activeAd.id ? 0 : Math.max(0, Math.min(30, Number(activeAd.delaySeconds || 0))) * 1000;
    const timer = window.setTimeout(() => setCanShowDelayed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [activeAd?.id, activeAd?.delaySeconds, previewAdId]);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const adId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!adId) return;
      setClosed(false);
      setPreviewAdId(adId);
      setIndex(0);
      setDismissedVersion((current) => current + 1);
    };

    window.addEventListener(ANNOUNCEMENT_AD_PREVIEW_EVENT, handlePreview);
    return () => window.removeEventListener(ANNOUNCEMENT_AD_PREVIEW_EVENT, handlePreview);
  }, []);

  if (closed || visibleAds.length === 0 || !activeAd || !canShowDelayed || (isExcluded && !previewAdId)) {
    return null;
  }

  const closeOverlay = () => {
    if (!previewAdId) {
      visibleAds.forEach((ad) => dismissIds([ad.id], ad.frequency));
    }
    setPreviewAdId(null);
    setClosed(true);
  };

  const skipActiveAd = () => {
    if (!previewAdId) {
      dismissIds([activeAd.id], activeAd.frequency);
    }
    if (previewAdId === activeAd.id) {
      setPreviewAdId(null);
    }
    setIndex((current) => Math.min(current, Math.max(visibleAds.length - 2, 0)));
    setDismissedVersion((current) => current + 1);
  };

  const goToTarget = (url?: string) => {
    if (!url) return;
    const target = url.trim();
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }
    navigate(target);
    closeOverlay();
  };

  const imageObjectClass = activeAd.imageFit === 'contain' ? 'object-contain bg-gray-50' : 'object-cover';

  if (activeAd.displayMode === 'top-banner') {
    return (
      <div className="fixed inset-x-0 top-0 z-[90] px-3 pt-3" dir="rtl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-amber-200/90 bg-white/95 p-3.5 shadow-2xl shadow-slate-950/15 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between ring-1 ring-amber-500/20">
          <div className="flex min-w-0 items-center gap-3.5">
            {activeAd.imageUrl ? (
              <img src={activeAd.imageUrl} alt={activeAd.title} className={`h-14 w-20 rounded-xl shadow-xs ${imageObjectClass}`} />
            ) : (
              <div className="h-14 w-20 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 shadow-xs flex items-center justify-center text-white font-black text-xs">
                إعلان
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">إعلان خاص</span>
                {previewAdId === activeAd.id ? (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-black text-sky-700">معاينة إدارية</span>
                ) : null}
              </div>
              <h3 className="truncate text-sm font-black text-slate-900">{activeAd.title}</h3>
              {activeAd.body ? <p className="line-clamp-1 text-xs font-bold text-slate-600">{activeAd.body}</p> : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {activeAd.ctaLabel && activeAd.ctaUrl ? (
              <button
                type="button"
                onClick={() => goToTarget(activeAd.ctaUrl)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 shadow-sm hover:bg-amber-400 transition"
              >
                <span>{activeAd.ctaLabel}</span>
                <ChevronLeft size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={skipActiveAd}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal Mode (Default)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <button
          type="button"
          onClick={closeOverlay}
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/40 text-white backdrop-blur-md hover:bg-slate-900/60 transition"
          aria-label="إغلاق الإعلان"
        >
          <X size={18} />
        </button>

        {activeAd.imageUrl ? (
          <div className="relative h-56 sm:h-64 w-full bg-slate-100 overflow-hidden">
            <img src={activeAd.imageUrl} alt={activeAd.title} className={`h-full w-full ${imageObjectClass}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 right-4">
              <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-slate-950 shadow-md">
                عرض مميز
              </span>
            </div>
          </div>
        ) : (
          <div className="h-28 w-full bg-gradient-to-br from-indigo-900 via-indigo-800 to-amber-500 p-6 text-white flex items-center justify-between">
            <div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black text-amber-200">
                إعلان رسمي
              </span>
              <h3 className="mt-2 text-lg font-black">{activeAd.title}</h3>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          {activeAd.imageUrl ? (
            <h3 className="text-xl font-black text-slate-900 leading-snug">{activeAd.title}</h3>
          ) : null}

          {activeAd.body ? (
            <p className="text-xs sm:text-sm font-bold text-slate-600 leading-relaxed">
              {activeAd.body}
            </p>
          ) : null}

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            {activeAd.ctaLabel && activeAd.ctaUrl ? (
              <button
                type="button"
                onClick={() => goToTarget(activeAd.ctaUrl)}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition"
              >
                <span>{activeAd.ctaLabel}</span>
                <ChevronLeft size={16} />
              </button>
            ) : null}

            <button
              type="button"
              onClick={closeOverlay}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
            >
              تخطي
            </button>
          </div>
        </div>

        {visibleAds.length > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-500">
            <span>
              إعلان {activeIndex + 1} من {visibleAds.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="rounded-lg p-1 hover:bg-white disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                disabled={activeIndex === visibleAds.length - 1}
                onClick={() => setIndex((i) => Math.min(visibleAds.length - 1, i + 1))}
                className="rounded-lg p-1 hover:bg-white disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
