import type { CollectionEntry } from 'astro:content';
import { CAT_LABELS, formatDate, useTranslation } from '../i18n/translations';
import { astroSlugToUrl } from '../i18n/slugUtils';
import type { Lang } from '../i18n/translations';

type DayEntry = CollectionEntry<'days'>;
type ImageLike = string | { src: string };

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  tragedija: { bg: 'rgba(198,41,45,.12)', text: '#9f1720' },
  pokret: { bg: 'rgba(155,111,22,.14)', text: '#704b08' },
  korupcija: { bg: 'rgba(95,82,172,.13)', text: '#493b94' },
  policija: { bg: 'rgba(47,103,159,.13)', text: '#24547f' },
  politika: { bg: 'rgba(47,124,91,.12)', text: '#236346' },
  svet: { bg: 'rgba(72,78,88,.12)', text: '#4b535f' },
};

function localized<T>(values: Partial<Record<Lang, T>> | undefined, lang: Lang, fallback?: T): T | undefined {
  return values?.[lang] ?? values?.sr ?? fallback;
}

function imageSrc(src: ImageLike): string {
  return typeof src === 'string' ? src : src.src;
}

function localizeAttribution(attribution: DayEntry['data']['quotes'][number]['attribution'], lang: Lang): string {
  return typeof attribution === 'string'
    ? attribution
    : localized(attribution, lang, '') ?? '';
}

export function renderPlainMarkdown(text: string): string {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('## ')) return `<h2>${part.slice(3)}</h2>`;
      if (part.startsWith('# ')) return `<h1>${part.slice(2)}</h1>`;
      return `<p>${part.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

export function getDayView(day: DayEntry, lang: Lang) {
  const { data } = day;
  const tr = useTranslation(lang);
  const urlSlug = astroSlugToUrl(day.slug);

  const categories = data.categories.map((cat) => ({
    key: cat,
    label: CAT_LABELS[lang][cat],
    color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.svet,
  }));

  const facts = localized(data.facts, lang, []) ?? [];
  const claims = localized(data.claims, lang, []) ?? [];

  return {
    slug: day.slug,
    urlSlug,
    url: lang === 'sr' ? `/dan/${urlSlug}` : `/${lang}/dan/${urlSlug}`,
    homeUrl: lang === 'sr' ? '/' : `/${lang}`,
    canonicalSlug: `/dan/${urlSlug}`,
    date: data.date,
    dateLabel: formatDate(data.date, lang),
    categories,
    title: localized(data.title, lang, day.slug) ?? day.slug,
    lead: localized(data.lead, lang, '') ?? '',
    thumbnail: {
      src: imageSrc(data.thumbnail.src),
      alt: localized(data.thumbnail.alt, lang, '') ?? '',
      type: data.thumbnail.type,
      badge: tr(`media${data.thumbnail.type.charAt(0).toUpperCase() + data.thumbnail.type.slice(1)}`),
    },
    media: (data.media ?? []).map((item) => ({
      src: imageSrc(item.src),
      type: item.type,
      caption: localized(item.caption, lang, '') ?? '',
      embedUrl: item.embedUrl,
    })),
    facts,
    claims,
    hasFacts: facts.length > 0,
    hasClaims: claims.length > 0,
    factPill: tr('factLabel').split('—')[0].trim(),
    claimPill: tr('claimLabel').split('—')[0].trim(),
    quotes: (data.quotes ?? []).map((quote) => ({
      text: localized(quote.text, lang, quote.text.sr) ?? '',
      attribution: localizeAttribution(quote.attribution, lang),
      verified: quote.verified,
    })),
    sources: data.sources,
    bodyTranslation: localized(data.bodyTranslations, lang, undefined),
  };
}
