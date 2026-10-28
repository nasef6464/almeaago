export type PlatformFontFamily =
    | 'tajawal'
    | 'cairo'
    | 'almarai'
    | 'readex-pro'
    | 'ibm-plex-sans-arabic'
    | 'noto-naskh-arabic'
    | 'noto-kufi-arabic'
    | 'system'
    | 'custom';

export interface PlatformFontUpload {
    name?: string;
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
}

export interface PlatformFontSettings {
    key: string;
    bodyFont: PlatformFontFamily;
    headingFont: PlatformFontFamily;
    navigationFont?: PlatformFontFamily;
    buttonFont?: PlatformFontFamily;
    bodySize?: string;
    headingSize?: string;
    navigationSize?: string;
    buttonSize?: string;
    bodyWeight?: string;
    headingWeight?: string;
    navigationWeight?: string;
    buttonWeight?: string;
    bodyColor?: string;
    headingColor?: string;
    navigationColor?: string;
    buttonColor?: string;
    bodyCustomFont?: PlatformFontUpload;
    headingCustomFont?: PlatformFontUpload;
    updatedAt?: string | number;
}
