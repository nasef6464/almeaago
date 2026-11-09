import React, { useMemo } from 'react';
import { Phone } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export interface FloatingContactWidgetProps {
  whatsappNumber?: string;
  whatsappMessage?: string;
  showOnPublicPages?: boolean;
  showOnDashboardPages?: boolean;
}

export const FloatingContactWidget: React.FC<FloatingContactWidgetProps> = ({
  whatsappNumber = '966500000000',
  whatsappMessage = 'مرحبًا بكم في منصة المئة، لدي استفسار بخصوص...',
  showOnPublicPages = true,
  showOnDashboardPages = true,
}) => {
  const location = useLocation();

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

  const isVisible = isDashboard ? showOnDashboardPages : showOnPublicPages;

  const whatsappHref = useMemo(() => {
    const cleanNumber = String(whatsappNumber).replace(/[^\d]/g, '');
    if (!cleanNumber) return '';
    const text = encodeURIComponent(whatsappMessage);
    return `https://wa.me/${cleanNumber}?text=${text}`;
  }, [whatsappNumber, whatsappMessage]);

  if (!isVisible || !whatsappHref) return null;

  return (
    <aside aria-label="تواصل معنا عبر واتساب">
      <a
        href={whatsappHref}
        target="_blank"
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
