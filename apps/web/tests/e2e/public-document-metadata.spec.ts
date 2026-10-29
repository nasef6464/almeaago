import { expect, test } from '@playwright/test';

const sourceTitle = 'ALMEAA CODAX | Qudrat & Tahsili';
const protectedRoutes = [
  '/dashboard',
  '/admin-dashboard',
  '/instructor-dashboard',
  '/supervisor-dashboard',
  '/parent-dashboard',
  '/quiz',
  '/results',
  '/reports',
  '/profile',
  '/favorites',
  '/my-quizzes',
  '/reset-password',
  '/verify-email',
];

test('public document restores original SEO, manifest and crawler boundaries at all RTL widths', async ({ page, request }, testInfo) => {
  const manifestResponse = await request.get('/site.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: 'ALMEAA CODAX',
    short_name: 'ALMEAA',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ar',
    dir: 'rtl',
  });
  expect(manifest.icons).toContainEqual(expect.objectContaining({
    src: '/images/homepage-hero-boy-platform.webp',
    type: 'image/webp',
  }));
  const imageResponse = await request.get('/images/homepage-hero-boy-platform.webp');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/webp');

  const robotsResponse = await request.get('/robots.txt');
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();
  expect(robots).toContain('User-agent: *');
  expect(robots).toContain('Allow: /');
  for (const route of protectedRoutes) {
    expect(robots.split(/\r?\n/)).toContain(`Disallow: ${route}`);
  }

  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Keep the existing Arabic browser title until the shared header/site identity\n    // owner resolves its contract; source Open Graph title is checked below.\n    await expect(page).toHaveTitle(/منصة المئة/);
    const head = await page.evaluate(() => {
      const meta = (selector: string) => document.head.querySelector<HTMLMetaElement>(selector)?.content ?? '';
      return {
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        robots: meta('meta[name="robots"]'),
        locale: meta('meta[property="og:locale"]'),
        type: meta('meta[property="og:type"]'),
        siteName: meta('meta[property="og:site_name"]'),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        ogImage: meta('meta[property="og:image"]'),
        ogImageAlt: meta('meta[property="og:image:alt"]'),
        twitterCard: meta('meta[name="twitter:card"]'),
        twitterImage: meta('meta[name="twitter:image"]'),
        manifest: document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute('href') ?? '',
      };
    });
    expect(head).toMatchObject({
      lang: 'ar',
      dir: 'rtl',
      robots: 'index, follow',
      locale: 'ar_SA',
      type: 'website',
      siteName: 'ALMEAA CODAX',
      ogTitle: sourceTitle,
      ogImageAlt: 'منصة المئة للقدرات والتحصيلي',
      twitterCard: 'summary_large_image',
      manifest: '/site.webmanifest',
    });
    expect(head.ogDescription.length).toBeGreaterThan(10);
    expect(head.ogImage).toContain('/images/homepage-hero-boy-platform.webp');
    expect(head.twitterImage).toContain('/images/homepage-hero-boy-platform.webp');
    await testInfo.attach(`public-document-${width}`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});
