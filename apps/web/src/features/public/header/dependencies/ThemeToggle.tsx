import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'almeaa_theme';
type ThemeMode = 'light' | 'dark';

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

