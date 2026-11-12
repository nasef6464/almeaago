import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('almeaa_pwa_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      try {
        sessionStorage.setItem('almeaa_pwa_dismissed', 'true');
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('almeaa_pwa_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  return (
    <aside
      aria-label="تثبيت تطبيق المنصة"
      data-testid="pwa-install-banner"
      dir="rtl"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg rounded-3xl bg-slate-900/95 text-white p-4 shadow-2xl backdrop-blur-md border border-slate-700/80 animate-fade-in"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
            <Smartphone size={20} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <Sparkles size={12} />
              <span>تطبيق منصة المئة</span>
            </div>
            <p className="text-xs font-bold text-slate-200 truncate">
              ثبّت التطبيق على شاشة جهازك لسرعة التصفح وتدريب أسهل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            data-testid="pwa-install-confirm-btn"
            className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition flex items-center gap-1"
          >
            <Download size={13} />
            تثبيت
          </button>
        </div>
      </div>
    </aside>
  );
};
