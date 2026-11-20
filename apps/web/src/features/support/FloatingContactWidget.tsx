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
    const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    fetch(`${base}/api/v1/content/public-contact-widget`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Contact settings unavailable'); return response.json() as Promise<ContactSettings>; })
      .then(value => { if (!controller.signal.aborted) setSettings(value); })
      .catch(() => { if (!controller.signal.aborted) setSettings(null); });
    return () => controller.abort();
  }, []);

  const isDashboard = useMemo(() => {
    const path = location.pathname || '/';
    return (
      path.includes('dashboard') ||
      path.startsWith('/assessments') ||
      path.startsWith('/assessment-results') ||
      path.startsWith('/profile') ||
      path.startsWith('/reports') ||
      path.startsWith('/instructor-dashboard') ||
      path.startsWith('/trainer-dashboard') ||
      path.startsWith('/coach-dashboard') ||
      path.startsWith('/parent-dashboard') ||
      path.startsWith('/supervisor-dashboard') ||
      path.startsWith('/teacher-workspace')
    );
  }, [location.pathname]);

  const isVisible = settings?.enabled && settings.channel === 'whatsapp' && (isDashboard ? settings.showOnDashboardPages : settings.showOnPublicPages);

  const whatsappHref = useMemo(() => {
    const cleanNumber = String(settings?.whatsappNumber || '').replace(/[^\d]/g, '');
    if (!cleanNumber) return '';
    const text = encodeURIComponent(settings?.whatsappMessage || '');
    return `https://wa.me/${cleanNumber}?text=${text}`;
  }, [settings]);

  if (!isVisible || !whatsappHref) return null;

  return (
    <aside aria-label="تواصل معنا عبر واتساب">
      <a
        href={whatsappHref}
        target={settings?.openInNewTab ? '_blank' : '_self'}
        rel="noreferrer"
        className={`fixed ${
          isDashboard
            ? 'bottom-24 left-6 sm:bottom-24 sm:left-6 md:bottom-24 md:left-8'
            : 'bottom-24 right-4 sm:bottom-8 sm:right-8'
        } bg-[#25D366] hover:bg-[#20bd5a] text-white p-3.5 sm:p-4 rounded-full shadow-lg transition-all z-30 flex items-center justify-center hover:scale-105 active:scale-95`}
        aria-label="تواصل معنا عبر واتساب"
        title="تواصل معنا عبر واتساب"
      >
        <Phone size={24} fill="white" />
      </a>
    </aside>
  );
};
