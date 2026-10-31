export type AnnouncementAudience = 'all' | 'guest' | 'student' | 'parent' | 'staff';
export type AnnouncementDisplayMode = 'modal' | 'top-banner';
export type AnnouncementFrequency = 'session' | 'once' | 'always';
export type AnnouncementImageFit = 'cover' | 'contain';

export interface AnnouncementAd {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  audience: AnnouncementAudience;
  displayMode?: AnnouncementDisplayMode;
  frequency?: AnnouncementFrequency;
  imageFit?: AnnouncementImageFit;
  delaySeconds?: number;
  isActive: boolean;
  priority: number;
  startsAt?: number;
  endsAt?: number;
  createdAt: number;
  updatedAt?: number;
}
