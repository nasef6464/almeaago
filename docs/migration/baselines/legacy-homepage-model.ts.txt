import mongoose, { Schema } from "mongoose";

const homepageStatSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    mode: { type: String, enum: ["dynamic", "manual"], default: "dynamic" },
    source: { type: String, enum: ["students", "courses", "assets", "rating"], default: "students" },
    manualValue: { type: String, default: "" },
  },
  { _id: false },
);

const homepageTestimonialSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    degree: { type: String, default: "" },
    text: { type: String, required: true },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const homepageHeroSchema = new Schema(
  {
    badgeText: { type: String, default: "" },
    titlePrefix: { type: String, default: "" },
    titleHighlight: { type: String, default: "" },
    titleSuffix: { type: String, default: "" },
    description: { type: String, default: "" },
    primaryCtaLabel: { type: String, default: "" },
    primaryCtaLink: { type: String, default: "" },
    secondaryCtaLabel: { type: String, default: "" },
    secondaryCtaLink: { type: String, default: "" },
    tertiaryCtaLabel: { type: String, default: "" },
    tertiaryCtaLink: { type: String, default: "" },
    badgeTextColor: { type: String, default: "" },
    titlePrefixColor: { type: String, default: "" },
    titleHighlightColor: { type: String, default: "" },
    titleSuffixColor: { type: String, default: "" },
    descriptionColor: { type: String, default: "" },
    primaryCtaColor: { type: String, default: "" },
    secondaryCtaColor: { type: String, default: "" },
    tertiaryCtaColor: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    galleryImages: { type: [String], default: [] },
    autoRotateImages: { type: Boolean, default: true },
    rotateIntervalSeconds: { type: Number, default: 6 },
    floatingCardTitle: { type: String, default: "" },
    floatingCardSubtitle: { type: String, default: "" },
    floatingCardProgressLabel: { type: String, default: "" },
    floatingCardProgressValue: { type: String, default: "" },
  },
  { _id: false },
);

const homepageBrandSchema = new Schema(
  {
    logoUrl: { type: String, default: "" },
    logoAlt: { type: String, default: "" },
    logoText: { type: String, default: "" },
    logoAccentText: { type: String, default: "" },
  },
  { _id: false },
);

const homepageSectionsSchema = new Schema(
  {
    featuredCoursesTitle: { type: String, default: "" },
    featuredCoursesSubtitle: { type: String, default: "" },
    featuredArticlesTitle: { type: String, default: "" },
    featuredArticlesSubtitle: { type: String, default: "" },
    whyChooseTitle: { type: String, default: "" },
    whyChooseDescription: { type: String, default: "" },
    testimonialsTitle: { type: String, default: "" },
    testimonialsSubtitle: { type: String, default: "" },
  },
  { _id: false },
);

const homepageTypographySchema = new Schema(
  {
    headingFont: { type: String, enum: ["tajawal", "system", "serif"], default: "tajawal" },
    bodyFont: { type: String, enum: ["tajawal", "system", "serif"], default: "tajawal" },
    headingWeight: { type: String, enum: ["bold", "black"], default: "black" },
  },
  { _id: false },
);

const homepageNavigationItemSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: "" },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const homepageNavigationSchema = new Schema(
  {
    showAutoPaths: { type: Boolean, default: true },
    moreLabel: { type: String, default: "أخرى" },
    items: { type: [homepageNavigationItemSchema], default: [] },
  },
  { _id: false },
);

const homepageSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    studentExperience: {
      type: new Schema({ visibilityMode: { type: String, enum: ['all', 'enrolled'], default: 'all' }, promptEnrollment: { type: Boolean, default: true } }, { _id: false }),
      default: () => ({}),
    },
    brand: { type: homepageBrandSchema, default: () => ({}) },
    hero: { type: homepageHeroSchema, default: () => ({}) },
    stats: { type: [homepageStatSchema], default: [] },
    testimonials: { type: [homepageTestimonialSchema], default: [] },
    sections: { type: homepageSectionsSchema, default: () => ({}) },
    typography: { type: homepageTypographySchema, default: () => ({}) },
    navigation: { type: homepageNavigationSchema, default: () => ({}) },
    featuredPathIds: { type: [String], default: [] },
    featuredCourseIds: { type: [String], default: [] },
    featuredArticleLessonIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

homepageSettingsSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.__v;
    return safeRet;
  },
});

export const HomepageSettingsModel = mongoose.model("HomepageSettings", homepageSettingsSchema);
