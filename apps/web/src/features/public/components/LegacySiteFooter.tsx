import React from 'react';
import { Link } from 'react-router-dom';

export function LegacySiteFooter() {
  return (
<footer className="border-t border-gray-100 bg-gray-50">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm font-bold text-gray-600 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                        <Link to="/about" className="hover:text-indigo-700">من نحن</Link>
                        <Link to="/contact" className="hover:text-indigo-700">تواصل معنا</Link>
                        <Link to="/faq" className="hover:text-indigo-700">الأسئلة الشائعة</Link>
                        <Link to="/privacy" className="hover:text-indigo-700">سياسة الخصوصية</Link>
                        <Link to="/terms" className="hover:text-indigo-700">الشروط والأحكام</Link>
                    </div>
                    <div className="text-xs text-gray-500">منصة المئة للقدرات والتحصيلي</div>
                </div>
            </footer>
  );
}

export function showPublicFooter(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  // Legacy AppRouteTree renders these public entries inside MainLayout, which always renders the footer.
  // Keep this route-scoped: dashboard, classroom and attempt shells have separate layouts in Go.
  if (['/', '/login', '/signup', '/about', '/contact', '/faq', '/privacy', '/terms', '/forgot-password', '/reset-password', '/verify-email', '/checkout'].includes(normalized)) return true;
  return /^\/(?:category|course)\/[^/]+$/.test(normalized);
}
