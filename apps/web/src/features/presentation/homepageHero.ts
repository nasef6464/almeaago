const DEFAULT_HERO_BOY_IMAGE =
    '/images/homepage-hero-boy-platform.webp?v=20260512';

const LEGACY_HERO_IMAGE_HINTS = [
    'saudi-arab-boy-student-wearing-thobe-holding-tablet_1258-122164',
    'girl',
    'woman',
    'female',
    'student-smiling',
    'young-woman',
    'portrait-woman',
    'girl-student',
];

export const resolveHomepageHeroImage = (imageUrl?: string) => {
    const trimmed = imageUrl?.trim();
    if (!trimmed) {
        return DEFAULT_HERO_BOY_IMAGE;
    }

    const normalized = trimmed.toLowerCase();
    if (LEGACY_HERO_IMAGE_HINTS.some((hint) => normalized.includes(hint))) {
        return DEFAULT_HERO_BOY_IMAGE;
    }

    return trimmed;
};

import type {HomepageHeroSettings} from './homepage-types';
export function heroRotateSeconds(value?:number){return Math.max(3,Math.min(60,Number(value)||6));}
export function heroGallery(hero:HomepageHeroSettings,presets:{url:string;alt:string}[]){const primary=resolveHomepageHeroImage(hero.imageUrl);const alt=hero.imageAlt || 'طالب يستخدم منصة المئة';const result=[{url:primary,alt}];if(hero.galleryImages?.length){hero.galleryImages.forEach((url,index)=>{if(url?.trim()&&url!==primary)result.push({url,alt:presets.find(p=>p.url===url)?.alt || `${alt} - ${index+2}`});});}else{presets.forEach(p=>{if(!result.some(item=>item.url===p.url))result.push(p);});}return result;}
