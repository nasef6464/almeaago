import { useEffect, useState } from 'react';
import type { AnnouncementAd } from './announcement-types';

const STORAGE_KEY = 'almeaa_announcement_ads';

export const DEFAULT_ANNOUNCEMENT_ADS: AnnouncementAd[] = [
  {
    id: 'ad_welcome_offer',
    title: 'مفاجأة سارة - خصم خاص على الاشتراكات',
    body: 'استفد من العرض الحصري لمنصة المئة واشترك الآن للوصول الكامل إلى بنك الأسئلة والشروحات التفاعلية.',
    ctaLabel: 'استفد من العرض الآن',
    ctaUrl: '/pricing',
    imageUrl: '/images/score-celebration.jpg',
    audience: 'all',
    displayMode: 'modal',
    frequency: 'session',
    priority: 5,
    isActive: true,
    delaySeconds: 1,
    imageFit: 'cover',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'ad_qudrat_launch',
    title: 'انطلاق تدريب مسار القدرات العامة',
    body: 'ابدأ خطتك المكثفة مع شروحات الكمي واللفظي واختبارات المحاكاة الذكية المقاسة بالوقت.',
    ctaLabel: 'ابدأ التدريب فوراً',
    ctaUrl: '/category/018f0000-0000-7000-8000-000000000030',
    imageUrl: '/images/qudrat-champion.jpg',
    audience: 'student',
    displayMode: 'modal',
    frequency: 'session',
    priority: 10,
    isActive: true,
    delaySeconds: 0,
    imageFit: 'cover',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
  },
  {
    id: 'ad_nafes_banner',
    title: 'اختبارات نافس الوطنية المحاكية',
    body: 'قيّم مهاراتك في اختبارات نافس الوزارية مع تصحيح فوري ورصد للمفاهيم التي تحتاج تقوية.',
    ctaLabel: 'خُض الاختبار التجريبي',
    ctaUrl: '/category/a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44',
    imageUrl: '/images/mock-exam-simulation.jpg',
    audience: 'student',
    displayMode: 'top-banner',
    frequency: 'always',
    priority: 15,
    isActive: true,
    delaySeconds: 0,
    imageFit: 'cover',
    createdAt: Date.now() - 21600000,
    updatedAt: Date.now() - 21600000,
  },
];

function loadAds(): AnnouncementAd[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANNOUNCEMENT_ADS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ANNOUNCEMENT_ADS;
  } catch {
    return DEFAULT_ANNOUNCEMENT_ADS;
  }
}

function saveAds(ads: AnnouncementAd[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
    window.dispatchEvent(new CustomEvent('almeaa-announcement-ads-changed'));
  } catch {
    // ignore in restricted mode
  }
}

export function useAnnouncementAds() {
  const [ads, setAds] = useState<AnnouncementAd[]>(loadAds);

  useEffect(() => {
    const handleSync = () => setAds(loadAds());
    window.addEventListener('storage', handleSync);
    window.addEventListener('almeaa-announcement-ads-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('almeaa-announcement-ads-changed', handleSync);
    };
  }, []);

  const createAd = (newAd: AnnouncementAd) => {
    const next = [newAd, ...ads];
    setAds(next);
    saveAds(next);
  };

  const updateAd = (id: string, patch: Partial<AnnouncementAd>) => {
    const next = ads.map((ad) => (ad.id === id ? { ...ad, ...patch, updatedAt: Date.now() } : ad));
    setAds(next);
    saveAds(next);
  };

  const deleteAd = (id: string) => {
    const next = ads.filter((ad) => ad.id !== id);
    setAds(next);
    saveAds(next);
  };

  const resetToDefaults = () => {
    setAds(DEFAULT_ANNOUNCEMENT_ADS);
    saveAds(DEFAULT_ANNOUNCEMENT_ADS);
  };

  return {
    ads,
    createAd,
    updateAd,
    deleteAd,
    resetToDefaults,
  };
}
