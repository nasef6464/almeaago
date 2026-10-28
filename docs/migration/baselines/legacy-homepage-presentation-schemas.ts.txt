import { z } from "zod";
import { DB_GROWTH_BUDGETS } from "../../database/dbGrowthBudgets.js";

export const announcementAdSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional().default(""),
  imageUrl: z.string().max(DB_GROWTH_BUDGETS.inlineAdminMediaChars).optional().default(""),
  ctaLabel: z.string().optional().default(""),
  ctaUrl: z.string().optional().default(""),
  audience: z.enum(["all", "guest", "student", "parent", "staff"]).default("all"),
  displayMode: z.enum(["modal", "top-banner"]).default("modal"),
  frequency: z.enum(["always", "session", "once"]).default("session"),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  delaySeconds: z.number().min(0).max(30).default(0),
  isActive: z.boolean().default(true),
  priority: z.number().default(0),
  startsAt: z.number().nullable().optional(),
  endsAt: z.number().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const announcementAdUpdateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  imageUrl: z.string().max(DB_GROWTH_BUDGETS.inlineAdminMediaChars).optional(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  audience: z.enum(["all", "guest", "student", "parent", "staff"]).optional(),
  displayMode: z.enum(["modal", "top-banner"]).optional(),
  frequency: z.enum(["always", "session", "once"]).optional(),
  imageFit: z.enum(["cover", "contain"]).optional(),
  delaySeconds: z.number().min(0).max(30).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
  startsAt: z.number().nullable().optional(),
  endsAt: z.number().nullable().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const platformFontUploadSchema = z.object({
  name: z.string().max(80).optional().default(""),
  dataUrl: z
    .string()
    .max(700_000)
    .regex(/^data:font\/(woff2?|ttf|otf);base64,[A-Za-z0-9+/=]+$/)
    .optional()
    .or(z.literal("")),
  fileName: z.string().max(160).optional().default(""),
  mimeType: z.string().max(80).optional().default(""),
  size: z.number().min(0).max(500_000).optional().default(0),
});

const platformFontFamilySchema = z
  .enum([
    "tajawal",
    "cairo",
    "almarai",
    "readex-pro",
    "ibm-plex-sans-arabic",
    "noto-naskh-arabic",
    "noto-kufi-arabic",
    "system",
    "custom",
  ])
  .default("tajawal");
const platformFontSizeSchema = z.string().regex(/^\d{1,2}(\.\d)?(px|rem)$/).optional().or(z.literal(""));
const platformFontWeightSchema = z
  .enum(["300", "400", "500", "600", "700", "800", "900", "normal", "bold"])
  .optional()
  .or(z.literal(""));
const platformFontColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal(""));

export const platformFontSettingsSchema = z.object({
  bodyFont: platformFontFamilySchema,
  headingFont: platformFontFamilySchema,
  navigationFont: platformFontFamilySchema,
  buttonFont: platformFontFamilySchema,
  bodySize: platformFontSizeSchema,
  headingSize: platformFontSizeSchema,
  navigationSize: platformFontSizeSchema,
  buttonSize: platformFontSizeSchema,
  bodyWeight: platformFontWeightSchema,
  headingWeight: platformFontWeightSchema,
  navigationWeight: platformFontWeightSchema,
  buttonWeight: platformFontWeightSchema,
  bodyColor: platformFontColorSchema,
  headingColor: platformFontColorSchema,
  navigationColor: platformFontColorSchema,
  buttonColor: platformFontColorSchema,
  bodyCustomFont: platformFontUploadSchema.optional(),
  headingCustomFont: platformFontUploadSchema.optional(),
});

const homepageStatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  mode: z.enum(["dynamic", "manual"]).default("dynamic"),
  source: z.enum(["students", "courses", "assets", "rating"]).default("students"),
  manualValue: z.string().optional(),
});

const homepageTestimonialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  degree: z.string().optional(),
  text: z.string().min(1),
  image: z.string().optional(),
});

export const homepageSettingsSchema = z.object({
  studentExperience: z.object({ visibilityMode: z.enum(['all', 'enrolled']), promptEnrollment: z.boolean() }).optional(),
  brand: z
    .object({
      logoUrl: z.string().optional(),
      logoAlt: z.string().optional(),
      logoText: z.string().optional(),
      logoAccentText: z.string().optional(),
    })
    .optional(),
  hero: z
    .object({
      badgeText: z.string().optional(),
      titlePrefix: z.string().optional(),
      titleHighlight: z.string().optional(),
      titleSuffix: z.string().optional(),
      description: z.string().optional(),
      primaryCtaLabel: z.string().optional(),
      primaryCtaLink: z.string().optional(),
      secondaryCtaLabel: z.string().optional(),
      secondaryCtaLink: z.string().optional(),
      tertiaryCtaLabel: z.string().optional(),
      tertiaryCtaLink: z.string().optional(),
      badgeTextColor: z.string().optional(),
      titlePrefixColor: z.string().optional(),
      titleHighlightColor: z.string().optional(),
      titleSuffixColor: z.string().optional(),
      descriptionColor: z.string().optional(),
      primaryCtaColor: z.string().optional(),
      secondaryCtaColor: z.string().optional(),
      tertiaryCtaColor: z.string().optional(),
      imageUrl: z.string().optional(),
      imageAlt: z.string().optional(),
      galleryImages: z.array(z.string().max(1_500_000)).max(10).optional(),
      autoRotateImages: z.boolean().optional(),
      rotateIntervalSeconds: z.number().min(3).max(60).optional(),
      floatingCardTitle: z.string().optional(),
      floatingCardSubtitle: z.string().optional(),
      floatingCardProgressLabel: z.string().optional(),
      floatingCardProgressValue: z.string().optional(),
    })
    .optional(),
  stats: z.array(homepageStatSchema).optional(),
  testimonials: z.array(homepageTestimonialSchema).optional(),
  sections: z
    .object({
      featuredCoursesTitle: z.string().optional(),
      featuredCoursesSubtitle: z.string().optional(),
      featuredArticlesTitle: z.string().optional(),
      featuredArticlesSubtitle: z.string().optional(),
      whyChooseTitle: z.string().optional(),
      whyChooseDescription: z.string().optional(),
      testimonialsTitle: z.string().optional(),
      testimonialsSubtitle: z.string().optional(),
    })
    .optional(),
  typography: z
    .object({
      headingFont: z.enum(["tajawal", "system", "serif"]).optional(),
      bodyFont: z.enum(["tajawal", "system", "serif"]).optional(),
      headingWeight: z.enum(["bold", "black"]).optional(),
    })
    .optional(),
  navigation: z
    .object({
      showAutoPaths: z.boolean().optional(),
      moreLabel: z.string().optional(),
      items: z
        .array(
          z.object({
            id: z.string(),
            label: z.string().optional(),
            visible: z.boolean().optional(),
            order: z.number().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  featuredPathIds: z.array(z.string()).optional(),
  featuredCourseIds: z.array(z.string()).optional(),
  featuredArticleLessonIds: z.array(z.string()).optional(),
});
