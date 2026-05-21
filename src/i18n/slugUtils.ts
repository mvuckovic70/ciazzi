/**
 * Astro content collection slug = filename without extension = "2025-03-15"
 * URL slug = "15-03-2025"
 */
export function astroSlugToUrl(astroSlug: string): string {
  // "2025-03-15" → "15-03-2025"
  const [y, m, d] = astroSlug.split('-');
  return `${d}-${m}-${y}`;
}

export function urlSlugToAstro(urlSlug: string): string {
  // "15-03-2025" → "2025-03-15"
  const [d, m, y] = urlSlug.split('-');
  return `${y}-${m}-${d}`;
}
