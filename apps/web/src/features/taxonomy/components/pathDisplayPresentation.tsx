import React from 'react';
import { resolveIconComponent, LUCIDE_ICONS_MAP, EDUCATIONAL_ICONS, ICON_CATEGORIES } from '../../public/header/pages/educationalIcons';

export { resolveIconComponent, LUCIDE_ICONS_MAP, EDUCATIONAL_ICONS, ICON_CATEGORIES };

const colorMap: Record<string, { soft: string; text: string; border: string }> = {
  gray: { soft: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
  indigo: { soft: '#e0e7ff', text: '#4f46e5', border: '#c7d2fe' },
  amber: { soft: '#fef3c7', text: '#b45309', border: '#fde68a' },
  emerald: { soft: '#d1fae5', text: '#047857', border: '#a7f3d0' },
  purple: { soft: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  rose: { soft: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
  blue: { soft: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
};

export const resolveColor = (value?: string) => {
  if (!value) return colorMap.gray;
  if (value.startsWith('#')) {
    return { soft: `${value}18`, text: value, border: `${value}33` };
  }
  return colorMap[value] || colorMap.gray;
};

export interface PathDisplaySettings {
  showSubjectCards?: boolean;
  showMockExamCard?: boolean;
  showPackageCard?: boolean;
  stageLabel?: string;
  stageSelection?: string;
  studentTemplate?: string;
}

const defaultPathDisplaySettings: Required<Pick<PathDisplaySettings, 'showSubjectCards' | 'showMockExamCard' | 'showPackageCard'>> = {
  showSubjectCards: true,
  showMockExamCard: true,
  showPackageCard: true,
};

export const resolvePathDisplaySettings = (path?: { settings?: PathDisplaySettings | null }): Required<Pick<PathDisplaySettings, 'showSubjectCards' | 'showMockExamCard' | 'showPackageCard'>> => ({
  ...defaultPathDisplaySettings,
  ...(path?.settings || {}),
});

export const getPathIcon = (path: any, className = 'w-8 h-8 object-contain') => {
  if (path?.iconUrl) return <img src={path.iconUrl} alt={path.name || 'مسار'} className={className} />;
  return resolveIconComponent(path?.icon, className, '📚');
};

export const getSubjectIcon = (subject: any, className = 'w-8 h-8 object-contain') => {
  if (subject?.iconUrl) return <img src={subject.iconUrl} alt={subject.name || 'مادة'} className={className} />;
  return resolveIconComponent(subject?.icon, className, '📖');
};

export const getLevelIcon = (level: any, className = 'w-6 h-6 object-contain') => {
  if (level?.iconUrl) return <img src={level.iconUrl} alt={level.name || 'مرحلة'} className={className} />;
  if (level?.icon) return resolveIconComponent(level.icon, className, '🎓');
  
  // Intelligent stage name fallback
  const name = String(level?.name || '');
  if (name.includes('ابتدائي')) return resolveIconComponent('🎒', className, '🎒');
  if (name.includes('متوسط')) return resolveIconComponent('🏫', className, '🏫');
  if (name.includes('ثانوي')) return resolveIconComponent('🎓', className, '🎓');
  return resolveIconComponent('🎓', className, '🎓');
};

export const renderPlatformIcon = (
  icon?: string,
  iconUrl?: string,
  fallback = '📚',
  className = 'w-6 h-6 object-contain'
) => {
  if (iconUrl) return <img src={iconUrl} alt="" className={className} />;
  return resolveIconComponent(icon, className, fallback);
};
