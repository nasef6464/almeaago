import React, { useEffect, useMemo, useState } from 'react';
import { Phone } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface ContactSettings {
  enabled: boolean;
  channel: string;
  whatsappNumber: string;
  whatsappMessage: string;
  openInNewTab: boolean;
  showOnPublicPages: boolean;
  showOnDashboardPages: boolean;
}

export const FloatingContactWidget: React.FC = () => {
  const location = useLocation();
  const [settings, setSettings] = useState<ContactSettings | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    fetch(`${apiBase}/api/v1/content/public-contact-widget`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Contact settings unavailable');
        return response.json() as Promise<ContactSettings>;
      })
      .then(setSettings)
      .catch(() => { if (!controller.signal.aborted) setSettings(null); });
    return () => controller.abort();
  }, []);

  const whatsappHref = useMemo(() => {
    if (!settings?.enabled || settings.channel !== 'whatsapp') return '';
    const path = location.pathname || '/';
    const isDashboard = path.includes('dashboard') || path.startsWith('/assessments') ||
      path.startsWith('/assessment-results') || path.startsWith('/profile') || path.startsWith('/reports');
    if (isDashboard ? !settings.showOnDashboardPages : !settings.showOnPublicPages) return '';
    const number = String(settings.whatsappNumber || '').replace(/[^\d]/g, '');
    if (!number) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(settings.whatsappMessage || '')}`;
  }, [settings, location.pathname]);

  if (!whatsappHref || !settings) return null;

  return (
    <aside aria-label="تواصل معنا عبر واتساب">
      <a
        href={whatsappHref}
        target={settings.openInNewTab ? '_blank' : '_self'}
        rel="noreferrer"
        className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 bg-[#25D366] hover:bg-[#20bd5a] text-white p-3.5 sm:p-4 rounded-full shadow-lg transition-all z-40 flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label="تواصل معنا عبر واتساب"
        title="تواصل معنا عبر واتساب"
      >
        <Phone size={24} fill="white" />
      </a>
    </aside>
  );
};
