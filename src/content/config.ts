import { defineCollection, z } from 'astro:content';

// Explicit per-language object — sigurnije od z.record(z.enum(...))
const langStr = z.object({
  sr: z.string(),
  en: z.string().optional(),
  de: z.string().optional(),
  fr: z.string().optional(),
  it: z.string().optional(),
  es: z.string().optional(),
});

const langStrArr = z.object({
  sr: z.array(z.string()).optional(),
  en: z.array(z.string()).optional(),
  de: z.array(z.string()).optional(),
  fr: z.array(z.string()).optional(),
  it: z.array(z.string()).optional(),
  es: z.array(z.string()).optional(),
});

const claimObj = z.object({
  text: z.string(),
  disputed: z.boolean().default(true),
});

const langClaims = z.object({
  sr: z.array(claimObj).optional(),
  en: z.array(claimObj).optional(),
  de: z.array(claimObj).optional(),
  fr: z.array(claimObj).optional(),
  it: z.array(claimObj).optional(),
  es: z.array(claimObj).optional(),
});

const days = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      categories: z.array(
        z.enum(['tragedija', 'pokret', 'korupcija', 'policija', 'politika', 'svet'])
      ),
      important:  z.boolean().default(false),

      thumbnail: z.object({
        src:  z.union([image(), z.string()]),
        type: z.enum(['foto', 'video', 'grafika']),
        alt:  langStr,
      }),

      media: z.array(z.object({
        src:      z.union([image(), z.string()]),
        type:     z.enum(['foto', 'video', 'audio']),
        caption:  langStr.optional(),
        embedUrl: z.string().optional(),
      })).optional(),

      title:  langStr,
      lead:   langStr,

      facts:  langStrArr.optional(),
      claims: langClaims.optional(),

      quotes: z.array(z.object({
        text:         langStr,
        attribution:  langStr,
        verified:     z.boolean().default(false),
      })).optional(),

      sources: z.array(z.object({
        label:      z.string(),
        url:        z.string().optional(),
        archiveUrl: z.string().optional(),
        reliable:   z.boolean().default(true),
      })),
      bodyTranslations: langStr.optional(),
    }),
});

export const collections = { days };
