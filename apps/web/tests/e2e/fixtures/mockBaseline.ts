import type { Page, Route } from '@playwright/test';

export const DEFAULT_BASELINE_HOMEPAGE_SETTINGS = {
  key: 'default',
  brand: {
    logoText: 'ALMEAA',
    logoAccentText: 'Go',
  },
  hero: {
    badgeText: 'منصة قياس التعليمية الأولى',
    titlePrefix: 'طريقك نحو',
    titleHighlight: 'الدرجة الكاملة',
    titleSuffix: 'في اختبارات قياس',
    description: 'تدريب تفاعلي، شروحات ذكية، وأسئلة محاكية لاختبارات قياس والقدرات والتحصيلي.',
    primaryCtaLabel: 'ابدأ مجاناً',
    primaryCtaLink: '/register',
    secondaryCtaLabel: 'تصفح المسارات',
    secondaryCtaLink: '/paths',
  },
  navigation: {
    showAutoPaths: true,
    moreLabel: 'المزيد',
  },
  sections: {},
  stats: [],
  testimonials: [],
  featuredPathIds: [],
  featuredCourseIds: [],
};

export const DEFAULT_BASELINE_TAXONOMY_BOOTSTRAP = {
  paths: [],
  levels: [],
  subjects: [],
};

export const DEFAULT_BASELINE_FONT_SETTINGS = {
  key: 'default',
  bodyFont: 'tajawal',
  headingFont: 'tajawal',
  navigationFont: 'tajawal',
  buttonFont: 'tajawal',
  bodySize: '',
  headingSize: '',
  navigationSize: '',
  buttonSize: '',
  bodyWeight: '',
  headingWeight: '',
  navigationWeight: '',
  buttonWeight: '',
  bodyColor: '',
  headingColor: '',
  navigationColor: '',
  buttonColor: '',
};

export const DEFAULT_BASELINE_CONTACT_WIDGET = {
  enabled: false,
  channel: 'whatsapp',
  whatsappNumber: '',
  whatsappMessage: '',
  openInNewTab: false,
  showOnPublicPages: false,
  showOnDashboardPages: false,
};

export const DEFAULT_BASELINE_AUTH_ME = {
  user: null,
};

export const DEFAULT_BASELINE_CSRF = {
  csrfToken: 'baseline-csrf-token',
};

export const DEFAULT_BASELINE_NOTIFICATIONS = {
  items: [],
  unreadCount: 0,
};

/**
 * Installs default network route mocks for the 5 global shell endpoints
 * requested unconditionally on page load by root providers (StudentNavigationProvider,
 * PlatformFontBootstrap, FloatingContactWidget, AuthProvider), as well as CSRF,
 * notifications, and external web font providers.
 *
 * NOTE: In Playwright, `page.route` handlers are evaluated in reverse order
 * of registration (last registered handler runs first). Any route handlers
 * registered later in individual tests will automatically take precedence over
 * these baseline mocks.
 */
export async function installBaselineMocks(page: Page): Promise<void> {
  // 1. Auth Me endpoint -> Unauthenticated by default
  await page.route('**/api/v1/auth/me*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_AUTH_ME,
    });
  });

  // 2. Auth CSRF token endpoint -> Valid mock token for any write actions
  await page.route('**/api/v1/auth/csrf*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_CSRF,
    });
  });

  // 3. Homepage Settings -> Default canonical settings
  await page.route('**/api/v1/content/homepage-settings*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_HOMEPAGE_SETTINGS,
    });
  });

  // 4. Taxonomy Bootstrap -> Empty catalog by default (handles ?phase=core and ?phase=full)
  await page.route('**/api/v1/taxonomy/bootstrap*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_TAXONOMY_BOOTSTRAP,
    });
  });

  // 5. Platform Font Settings -> Canonical Tajawal typography settings
  await page.route('**/api/v1/content/platform-font-settings*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_FONT_SETTINGS,
    });
  });

  // 6. Public Contact Widget -> Disabled by default
  await page.route('**/api/v1/content/public-contact-widget*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_CONTACT_WIDGET,
    });
  });

  // 7. Notifications background polling -> Empty list
  await page.route('**/api/v1/notifications*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: DEFAULT_BASELINE_NOTIFICATIONS,
    });
  });

  // 8. Learning Navigation Preferences -> Empty preferences
  await page.route('**/api/v1/learning/navigation-preferences*', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferences: null }),
    });
  });

  // 9. Google Fonts isolation -> Prevent external network socket hang in CI
  await page.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\/.*/, (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: '/* mocked font css */',
    });
  });
}
