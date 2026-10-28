export interface StudentExperienceSettings { visibilityMode: 'all' | 'enrolled'; promptEnrollment: boolean; }
export interface HomepageHeroSettings {
    badgeText?: string;
    titlePrefix?: string;
    titleHighlight?: string;
    titleSuffix?: string;
    description?: string;
    primaryCtaLabel?: string;
    primaryCtaLink?: string;
    secondaryCtaLabel?: string;
    secondaryCtaLink?: string;
    tertiaryCtaLabel?: string;
    tertiaryCtaLink?: string;
    badgeTextColor?: string;
    titlePrefixColor?: string;
    titleHighlightColor?: string;
    titleSuffixColor?: string;
    descriptionColor?: string;
    primaryCtaColor?: string;
    secondaryCtaColor?: string;
    tertiaryCtaColor?: string;
    imageUrl?: string;
    imageAlt?: string;
    galleryImages?: string[];
    autoRotateImages?: boolean;
    rotateIntervalSeconds?: number;
    floatingCardTitle?: string;
    floatingCardSubtitle?: string;
    floatingCardProgressLabel?: string;
    floatingCardProgressValue?: string;
}

export interface HomepageStat {
    id: string;
    label: string;
    mode: 'dynamic' | 'manual';
    source: 'students' | 'courses' | 'assets' | 'rating';
    manualValue?: string;
}

export interface HomepageTestimonial {
    id: string;
    name: string;
    degree?: string;
    text: string;
    image?: string;
}

export interface HomepageSections {
    featuredCoursesTitle?: string;
    featuredCoursesSubtitle?: string;
    featuredArticlesTitle?: string;
    featuredArticlesSubtitle?: string;
    whyChooseTitle?: string;
    whyChooseDescription?: string;
    testimonialsTitle?: string;
    testimonialsSubtitle?: string;
}

export type HomepageFontFamily = 'tajawal' | 'system' | 'serif';
export type HomepageHeadingWeight = 'bold' | 'black';

export interface HomepageTypography {
    headingFont?: HomepageFontFamily;
    bodyFont?: HomepageFontFamily;
    headingWeight?: HomepageHeadingWeight;
}

export interface HomepageBrandSettings {
    logoUrl?: string;
    logoAlt?: string;
    logoText?: string;
    logoAccentText?: string;
}

export interface HomepageSettings {
    studentExperience?: StudentExperienceSettings;
    key: string;
    brand?: HomepageBrandSettings;
    hero: HomepageHeroSettings;
    stats: HomepageStat[];
    testimonials: HomepageTestimonial[];
    sections: HomepageSections;
    typography?: HomepageTypography;
    navigation?: HomepageNavigationSettings;
    featuredPathIds: string[];
    featuredCourseIds: string[];
    featuredArticleLessonIds?: string[];
}

export interface HomepageNavigationItem {
    id: 'home' | 'mock-exams' | 'pricing' | 'blog' | string;
    label?: string;
    visible?: boolean;
    order?: number;
}

export interface HomepageNavigationSettings {
    showAutoPaths?: boolean;
    moreLabel?: string;
    items?: HomepageNavigationItem[];
}

