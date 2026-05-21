import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://ciazzi.com',
  integrations: [mdx(),],
  i18n: {
    defaultLocale: 'sr',
    locales: ['sr', 'en', 'de', 'fr', 'it', 'es'],
    routing: {
      prefixDefaultLocale: false, // ciazzi.com/ = SR, ciazzi.com/en/ = EN
    },
  },
  image: {
    // Cloudflare R2 base URL — swap in when R2 bucket is ready
    // domains: ['r2.ciazzi.com'],
  },
  build: {
    // Clean URLs: /dan/15-03-2025 not /dan/15-03-2025.html
    format: 'directory',
  },
});
