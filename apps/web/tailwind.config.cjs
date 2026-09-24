/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
      },
      fontFamily: {
        sans: ['var(--platform-font-body)', 'Tajawal', 'ui-sans-serif', 'system-ui'],
        tajawal: ['var(--platform-font-body)', 'Tajawal', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        secondary: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        dark: {
          900: '#111827',
          800: '#1f2937',
        },
      },
    },
  },
  plugins: [],
};
