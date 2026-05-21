#!/usr/bin/env node
/**
 * ciazzi new-day CLI
 * 
 * Usage:
 *   node scripts/new-day.mjs 2025-05-21
 *   node scripts/new-day.mjs 2025-05-21 --cat pokret,policija
 *   node scripts/new-day.mjs 2025-05-21 --cat tragedija --important
 * 
 * Creates: src/content/days/YYYY-MM-DD.mdx
 * Opens in $EDITOR if set.
 */

import { writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const VALID_CATS = ['tragedija', 'pokret', 'korupcija', 'policija', 'politika', 'svet'];
const LANGS = ['sr', 'en', 'de', 'fr', 'it', 'es'];

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log(`
  Usage: node scripts/new-day.mjs <YYYY-MM-DD> [options]

  Options:
    --cat <cats>   Comma-separated categories (default: pokret)
                   Valid: ${VALID_CATS.join(', ')}
    --important    Mark as pinned/hero card
    --open         Open in \$EDITOR after creation
  `);
  process.exit(0);
}

const dateArg = args[0];
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error('❌  Date must be YYYY-MM-DD');
  process.exit(1);
}

const catIdx = args.indexOf('--cat');
const rawCats = catIdx !== -1 ? args[catIdx + 1].split(',') : ['pokret'];
const cats = rawCats.filter(c => VALID_CATS.includes(c));
if (!cats.length) {
  console.error(`❌  No valid categories. Choose from: ${VALID_CATS.join(', ')}`);
  process.exit(1);
}

const important = args.includes('--important');
const openEditor = args.includes('--open');

// ── Derive display values ────────────────────────────────────────────────────
const [year, month, day] = dateArg.split('-');
const slug = `${day}-${month}-${year}`;               // "21-05-2025"
const outPath = resolve(`src/content/days/${dateArg}.mdx`);

if (existsSync(outPath)) {
  console.error(`❌  File already exists: ${outPath}`);
  process.exit(1);
}

// ── Build alt text block ─────────────────────────────────────────────────────
const altLines = LANGS.map(l => `      ${l}: "TODO alt text in ${l}"`).join('\n');

// ── Build title/lead blocks ──────────────────────────────────────────────────
const titleLines = LANGS.map(l => `  ${l}: "TODO title in ${l}"`).join('\n');
const leadLines  = LANGS.map(l => `  ${l}: "TODO lead in ${l}"`).join('\n');
const factLines  = LANGS.map(l => `    ${l}:\n      - "TODO fact 1"\n      - "TODO fact 2"`).join('\n');
const claimLines = LANGS.map(l => `    ${l}:\n      - text: "TODO claim"\n        disputed: true`).join('\n');

// ── Template ─────────────────────────────────────────────────────────────────
const template = `---
date: "${dateArg}"
categories: [${cats.join(', ')}]
important: ${important}

thumbnail:
  # Local: src: ./media/${dateArg}/thumb.jpg
  # R2:    src: "https://r2.ciazzi.com/media/${dateArg}/thumb.jpg"
  src: "https://r2.ciazzi.com/media/${dateArg}/thumb.jpg"
  type: foto   # foto | video | grafika
  alt:
${altLines}

# media:
#   - src: "https://r2.ciazzi.com/media/${dateArg}/01.jpg"
#     type: foto
#     caption:
#       sr: ""
#       en: ""
#   - embedUrl: "https://www.youtube.com/embed/VIDEO_ID"
#     src: "https://r2.ciazzi.com/media/${dateArg}/video-thumb.jpg"
#     type: video

title:
${titleLines}

lead:
${leadLines}

facts:
${factLines}

claims:
${claimLines}

# quotes:
#   - text:
#       sr: ""
#       en: ""
#     attribution: "ime, funkcija (izvor: N1)"
#     verified: false

sources:
  - label: "N1"
    url: "https://n1info.rs/LINK"
    reliable: true
  # - label: "Reuters"
  #   url: "https://reuters.com/LINK"
  #   archiveUrl: "https://web.archive.org/web/..."

---

<!-- SR narrative body — MDX, podržava headings, bold, links -->
<!-- Ostali jezici: dodaj bodyTranslations u frontmatter ili napravi /[lang]/dan/[slug] override -->

TODO: Napiši narativ za ${dateArg}.

## Kontekst

## Šta se desilo

## Posledice / Reakcije
`;

// ── Write ────────────────────────────────────────────────────────────────────
writeFileSync(outPath, template, 'utf8');
console.log(`✅  Created: ${outPath}`);
console.log(`   Categories: ${cats.join(', ')}${important ? ' · IMPORTANT' : ''}`);
console.log(`   URL will be: ciazzi.com/dan/${slug}`);

if (openEditor && process.env.EDITOR) {
  try {
    execSync(`${process.env.EDITOR} "${outPath}"`, { stdio: 'inherit' });
  } catch (_) {
    // editor exit non-zero is fine
  }
}
