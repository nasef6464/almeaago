import { PlatformFontFamily, PlatformFontSettings, PlatformFontUpload } from '../types';

export const DEFAULT_PLATFORM_FONT_SETTINGS: PlatformFontSettings = {
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
    bodyCustomFont: {},
    headingCustomFont: {},
};

export const PLATFORM_FONT_OPTIONS: Array<{ id: PlatformFontFamily; label: string; cssFamily: string; googleFamily?: string; note: string }> = [
    { id: 'tajawal', label: 'Tajawal', cssFamily: "'Tajawal'", googleFamily: 'Tajawal:wght@300;400;500;700;800;900', note: 'الافتراضي الحالي للمنصة.' },
    { id: 'cairo', label: 'Cairo', cssFamily: "'Cairo'", googleFamily: 'Cairo:wght@300;400;500;700;800;900', note: 'واضح ومناسب للوحات والإدارة.' },
    { id: 'almarai', label: 'Almarai', cssFamily: "'Almarai'", googleFamily: 'Almarai:wght@300;400;700;800', note: 'خفيف ومرتب للأزرار والقوائم.' },
    { id: 'readex-pro', label: 'Readex Pro', cssFamily: "'Readex Pro'", googleFamily: 'Readex+Pro:wght@300;400;500;600;700', note: 'مريح للطلاب وواضح على الجوال.' },
    { id: 'ibm-plex-sans-arabic', label: 'IBM Plex Sans Arabic', cssFamily: "'IBM Plex Sans Arabic'", googleFamily: 'IBM+Plex+Sans+Arabic:wght@300;400;500;700;800', note: 'هادئ ومهني للنصوص الطويلة.' },
    { id: 'noto-naskh-arabic', label: 'Noto Naskh Arabic', cssFamily: "'Noto Naskh Arabic'", googleFamily: 'Noto+Naskh+Arabic:wght@400;500;600;700', note: 'مناسب للنصوص العلمية والمقالات.' },
    { id: 'noto-kufi-arabic', label: 'Noto Kufi Arabic', cssFamily: "'Noto Kufi Arabic'", googleFamily: 'Noto+Kufi+Arabic:wght@400;500;700;800', note: 'قوي للعناوين والواجهات التعليمية.' },
    { id: 'system', label: 'System', cssFamily: 'ui-sans-serif, system-ui', note: 'الأسرع تحميلًا إذا أردت تقليل الاعتماد الخارجي.' },
    { id: 'custom', label: 'خط مرفوع', cssFamily: 'var(--platform-custom-font-fallback)', note: 'ارفع WOFF/WOFF2 خفيفًا من الإدارة.' },
];

const getOption = (id?: PlatformFontFamily) =>
    PLATFORM_FONT_OPTIONS.find((option) => option.id === id) || PLATFORM_FONT_OPTIONS[0];

const cleanCssToken = (value?: string) => String(value || '').trim();
const normalizeHexColor = (value?: string) => (/^#[0-9a-fA-F]{6}$/.test(String(value || '').trim()) ? String(value).trim() : '');
const normalizeSize = (value?: string) => (/^\d{1,2}(\.\d)?(px|rem)$/.test(String(value || '').trim()) ? String(value).trim() : '');
const normalizeWeight = (value?: string) => (/^(300|400|500|600|700|800|900|normal|bold)$/.test(String(value || '').trim()) ? String(value).trim() : '');

export const normalizePlatformFontSettings = (settings?: Partial<PlatformFontSettings> | null): PlatformFontSettings => ({
    ...DEFAULT_PLATFORM_FONT_SETTINGS,
    ...settings,
    bodyFont: settings?.bodyFont || DEFAULT_PLATFORM_FONT_SETTINGS.bodyFont,
    headingFont: settings?.headingFont || DEFAULT_PLATFORM_FONT_SETTINGS.headingFont,
    navigationFont: settings?.navigationFont || DEFAULT_PLATFORM_FONT_SETTINGS.navigationFont,
    buttonFont: settings?.buttonFont || DEFAULT_PLATFORM_FONT_SETTINGS.buttonFont,
    bodySize: normalizeSize(settings?.bodySize),
    headingSize: normalizeSize(settings?.headingSize),
    navigationSize: normalizeSize(settings?.navigationSize),
    buttonSize: normalizeSize(settings?.buttonSize),
    bodyWeight: normalizeWeight(settings?.bodyWeight),
    headingWeight: normalizeWeight(settings?.headingWeight),
    navigationWeight: normalizeWeight(settings?.navigationWeight),
    buttonWeight: normalizeWeight(settings?.buttonWeight),
    bodyColor: normalizeHexColor(settings?.bodyColor),
    headingColor: normalizeHexColor(settings?.headingColor),
    navigationColor: normalizeHexColor(settings?.navigationColor),
    buttonColor: normalizeHexColor(settings?.buttonColor),
    bodyCustomFont: settings?.bodyCustomFont || {},
    headingCustomFont: settings?.headingCustomFont || {},
});

const removeElement = (id: string) => {
    document.getElementById(id)?.remove();
};

const ensureGoogleFonts = (settings: PlatformFontSettings) => {
    const families = [
        getOption(settings.bodyFont).googleFamily,
        getOption(settings.headingFont).googleFamily,
        getOption(settings.navigationFont).googleFamily,
        getOption(settings.buttonFont).googleFamily,
    ].filter(Boolean);

    if (!families.length) {
        removeElement('platform-font-google-link');
        return;
    }

    const href = `https://fonts.googleapis.com/css2?${[...new Set(families)].map((family) => `family=${family}`).join('&')}&display=swap`;
    let link = document.getElementById('platform-font-google-link') as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.id = 'platform-font-google-link';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.href = href;
};

const customFontCss = (name: string, upload?: PlatformFontUpload) => {
    if (!upload?.dataUrl || !name) {
        return '';
    }

    return `
@font-face {
  font-family: '${name}';
  src: url('${upload.dataUrl}') format('${upload.mimeType?.includes('woff2') ? 'woff2' : upload.mimeType?.includes('ttf') ? 'truetype' : upload.mimeType?.includes('otf') ? 'opentype' : 'woff'}');
  font-display: swap;
}`;
};

const getCssFamily = (font: PlatformFontFamily = 'tajawal', customName: string, fallback = "'Tajawal'") => {
    if (font === 'custom') {
        return customName ? `'${customName}', ${fallback}` : fallback;
    }

    return getOption(font).cssFamily;
};

const optionalRule = (property: string, value?: string) => {
    const cleanValue = cleanCssToken(value);
    return cleanValue ? `${property}: ${cleanValue};` : '';
};

export const applyPlatformFontSettings = (rawSettings?: Partial<PlatformFontSettings> | null) => {
    if (typeof document === 'undefined') {
        return;
    }

    const settings = normalizePlatformFontSettings(rawSettings);
    ensureGoogleFonts(settings);

    const bodyCustomName = settings.bodyCustomFont?.name?.trim() || 'PlatformCustomBody';
    const headingCustomName = settings.headingCustomFont?.name?.trim() || 'PlatformCustomHeading';
    const bodyFamily = getCssFamily(settings.bodyFont, bodyCustomName);
    const headingFamily = getCssFamily(settings.headingFont, headingCustomName, bodyFamily);
    const navigationFamily = getCssFamily(settings.navigationFont || settings.bodyFont, bodyCustomName, bodyFamily);
    const buttonFamily = getCssFamily(settings.buttonFont || settings.bodyFont, bodyCustomName, bodyFamily);

    document.documentElement.style.setProperty('--platform-font-body', bodyFamily);
    document.documentElement.style.setProperty('--platform-font-heading', headingFamily);
    document.documentElement.style.setProperty('--platform-font-navigation', navigationFamily);
    document.documentElement.style.setProperty('--platform-font-button', buttonFamily);

    let style = document.getElementById('platform-custom-font-style') as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = 'platform-custom-font-style';
        document.head.appendChild(style);
    }

    style.textContent = [
        settings.bodyFont === 'custom' ? customFontCss(bodyCustomName, settings.bodyCustomFont) : '',
        settings.headingFont === 'custom' ? customFontCss(headingCustomName, settings.headingCustomFont) : '',
        `
body {
  ${optionalRule('font-size', settings.bodySize)}
  ${optionalRule('font-weight', settings.bodyWeight)}
  ${optionalRule('color', settings.bodyColor)}
}
.platform-heading-font, h1, h2, h3 {
  font-family: var(--platform-font-heading), var(--platform-font-body), 'Tajawal', sans-serif;
  ${optionalRule('font-size', settings.headingSize)}
  ${optionalRule('font-weight', settings.headingWeight)}
  ${optionalRule('color', settings.headingColor)}
}
header, header a, header button {
  font-family: var(--platform-font-navigation), var(--platform-font-body), 'Tajawal', sans-serif;
  ${optionalRule('font-size', settings.navigationSize)}
  ${optionalRule('font-weight', settings.navigationWeight)}
  ${optionalRule('color', settings.navigationColor)}
}
button, .platform-button-font {
  font-family: var(--platform-font-button), var(--platform-font-body), 'Tajawal', sans-serif;
  ${optionalRule('font-size', settings.buttonSize)}
  ${optionalRule('font-weight', settings.buttonWeight)}
  ${optionalRule('color', settings.buttonColor)}
}`,
    ].filter(Boolean).join('\n');
};
