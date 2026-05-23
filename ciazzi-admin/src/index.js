/**
 * ciazzi-admin CF Worker
 * 
 * ENV VARS (set via wrangler secret or CF dashboard):
 *   ADMIN_PASSWORD   — lozinka za pristup adminu
 *   GITHUB_TOKEN     — GitHub fine-grained token (Contents: read/write na mvuckovic70/ciazzi)
 *   GITHUB_OWNER     — "mvuckovic70"
 *   GITHUB_REPO      — "ciazzi"
 *   GITHUB_BRANCH    — "main"
 *   R2_PUBLIC_URL    — "https://r2.ciazzi.com"
 *   ANTHROPIC_API_KEY — Claude API key za auto-prevod
 * 
 * R2 BINDING: MEDIA → ciazzi-media bucket
 */

// ── Utility ──────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, 401);
}

function checkAuth(request, env) {
  const auth = request.headers.get('X-Admin-Password');
  return auth === env.ADMIN_PASSWORD;
}

// ── GitHub API ────────────────────────────────────────────────────────────────

async function githubRequest(env, method, path, body) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'ciazzi-admin/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function getFileFromGitHub(env, filePath) {
  const res = await githubRequest(env, 'GET', `/contents/${filePath}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data;
}

async function listDaysFromGitHub(env) {
  const res = await githubRequest(env, 'GET', '/contents/src/content/days');
  if (!res.ok) return [];
  const files = await res.json();
  return files
    .filter(f => f.name.endsWith('.mdx'))
    .map(f => ({
      name: f.name,
      slug: f.name.replace('.mdx', ''),
      sha: f.sha,
    }))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

async function upsertDayToGitHub(env, date, content, existingSha) {
  const filePath = `src/content/days/${date}.mdx`;
  
  // Ako SHA nije prosleđen, fetchuj ga
  if (!existingSha) {
    const existing = await getFileFromGitHub(env, filePath);
    if (existing) existingSha = existing.sha;
  }

  const cleanContent = content.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const encoded = btoa(unescape(encodeURIComponent(cleanContent)));
  const body = {
    message: existingSha ? `update: dan ${date}` : `add: dan ${date}`,
    content: encoded,
    branch: env.GITHUB_BRANCH || 'main',
  };
  if (existingSha) body.sha = existingSha;
  const res = await githubRequest(env, 'PUT', `/contents/${filePath}`, body);
  return res;
}

// ── MDX Builder ───────────────────────────────────────────────────────────────

function buildMDX(data) {
  const LANGS = ['sr', 'en', 'de', 'fr', 'it', 'es'];
  function yamlStr(s) { return "'" + String(s || '').replace(/'/g, "''") + "'"; }
  function langBlock(obj, indent = '  ') {
    return LANGS.map(l => {
      const val = (obj && obj[l]) || '';
      return `${indent}${l}: ${yamlStr(val)}`;
    }).join('\n');
  }

  function langBlockOptional(obj, indent = '  ') {
    return LANGS.map(l => {
      const val = (obj && obj[l]) || '';
      return `${indent}${l}: ${yamlStr(val)}`;
    }).filter((_, i) => obj && obj[LANGS[i]]).join('\n');
  }

  let fm = `---
date: "${data.date}"
categories: [${(data.categories || ['pokret']).join(', ')}]
important: ${data.important ? 'true' : 'false'}

thumbnail:
  src: "${data.thumbnail?.src || ''}"
  type: ${data.thumbnail?.type || 'foto'}
  alt:
${langBlock(data.thumbnail?.alt, '    ')}

title:
${langBlock(data.title)}

lead:
${langBlock(data.lead)}
`;

  // Facts
  const hasFacts = data.facts && Object.values(data.facts).some(v => v && v.length);
  if (hasFacts) {
    fm += '\nfacts:\n';
    LANGS.forEach(l => {
      const items = data.facts[l];
      if (items && items.length) {
        fm += `  ${l}:\n`;
        items.forEach(item => {
          fm += `    - ${yamlStr(item)}\n`;
        });
      }
    });
  }

  // Claims
  const hasClaims = data.claims && Object.values(data.claims).some(v => v && v.length);
  if (hasClaims) {
    fm += '\nclaims:\n';
    LANGS.forEach(l => {
      const items = data.claims[l];
      if (items && items.length) {
        fm += `  ${l}:\n`;
        items.forEach(item => {
          fm += `    - text: ${yamlStr(item.text || '')}\n`;
          fm += `      disputed: ${item.disputed !== false ? 'true' : 'false'}\n`;
        });
      }
    });
  }

  // Quotes
  if (data.quotes && data.quotes.length) {
    fm += '\nquotes:\n';
    data.quotes.forEach(q => {
      fm += '  - text:\n';
      LANGS.forEach(l => {
        const t = q.text && q.text[l];
        if (t) fm += `      ${l}: ${yamlStr(t)}\n`;
      });
      fm += `    attribution:\n`;
      LANGS.forEach(l => {
        const val = (q.attribution && q.attribution[l]) || (typeof q.attribution === 'string' ? q.attribution : '');
        if (val) fm += `      ${l}: ${yamlStr(val)}\n`;
      });
      fm += `    verified: ${q.verified ? 'true' : 'false'}\n`;
    });
  }

  // Sources
  if (data.sources && data.sources.length) {
    fm += '\nsources:\n';
    data.sources.forEach(s => {
      fm += `  - label: ${yamlStr(s.label || '')}\n`;
      if (s.url) fm += `    url: "${s.url}"\n`;
      if (s.archiveUrl) fm += `    archiveUrl: "${s.archiveUrl}"\n`;
      fm += `    reliable: ${s.reliable !== false ? 'true' : 'false'}\n`;
    });
  } else {
    fm += '\nsources:\n  - label: "TODO"\n    reliable: true\n';
  }

  if (data.bodyTranslations && Object.values(data.bodyTranslations).some(v => v)) {
    fm += '\nbodyTranslations:\n';
    LANGS.forEach(l => {
      const val = data.bodyTranslations[l];
      if (val) fm += `  ${l}: ${yamlStr(val)}\n`;
    });
  }

  fm += '---\n\n';
  fm += (data.body || 'TODO: Napiši narativ.\n');
  return fm;
}

// ── Admin HTML (served from admin.html) ─────────────────────────────────────

import ADMIN_HTML from './admin.html';

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Password',
        },
      });
    }

    // Auth check
    if (path === '/api/auth' && request.method === 'POST') {
      const body = await request.json();
      if (body.password === env.ADMIN_PASSWORD) {
        return json({ ok: true });
      }
      return json({ ok: false }, 401);
    }

    // Serve HTML
    if (path === '/' || path === '') {
      return new Response(ADMIN_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // All other /api/* routes require auth
    if (!checkAuth(request, env)) return unauthorized();

    // POST /api/translate — auto-translate SR content to all languages
    if (path === '/api/translate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { field, value, context } = body;
        if (!value) return json({ error: 'no value' }, 400);

        const LANGS = { en: 'English', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish' };
        const contextHint = context ? ` Context: this is about the ${context}.` : ' Context: this is about the Serbian protests and student movement following the Novi Sad train station canopy collapse on November 1, 2024.';

        let prompt;
        if (field === 'facts_array' || field === 'claims_array') {
          const items = JSON.parse(value);
          prompt = `Translate each item in this Serbian JSON array into English, German, French, Italian, Spanish. Return ONLY a JSON object with keys en, de, fr, it, es, each containing a translated array in the same order.${contextHint}

Serbian array: ${JSON.stringify(items)}`;
        } else {
          prompt = `Translate the following Serbian text into ${Object.values(LANGS).join(', ')}. Return ONLY a JSON object with keys: en, de, fr, it, es. No explanation, no markdown, just the JSON object.${contextHint}

Serbian text: "${value}"`;
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        const translations = JSON.parse(clean);
        return json({ ok: true, translations });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }


    if (path === '/api/days' && request.method === 'GET') {
      try {
        const days = await listDaysFromGitHub(env);
        // Fetch title for each day (parse from cached frontmatter)
        const enriched = await Promise.all(days.slice(0, 100).map(async d => {
          try {
            const file = await getFileFromGitHub(env, `src/content/days/${d.slug}.mdx`);
            if (!file) return d;
            const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
            const content = new TextDecoder('utf-8').decode(bytes);
            const titleMatch = content.match(/^  sr: "(.+)"/m);
            const catsMatch = content.match(/^categories: \[(.+)\]/m);
            return {
              ...d,
              title: titleMatch ? titleMatch[1] : d.slug,
              cats: catsMatch ? catsMatch[1].split(',').map(s => s.trim()) : [],
            };
          } catch {
            return d;
          }
        }));
        return json(enriched);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // GET /api/day/:slug — get specific day parsed
    if (path.startsWith('/api/day/') && request.method === 'GET') {
      const slug = path.replace('/api/day/', '');
      const file = await getFileFromGitHub(env, `src/content/days/${slug}.mdx`);
      if (!file) return json({ error: 'not found' }, 404);
      // Proper UTF-8 decoding: atob gives binary string, TextDecoder converts to Unicode
      const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
      const raw = new TextDecoder('utf-8').decode(bytes);
      const parsed = parseMDX(raw);
      return json({ ...parsed, _sha: file.sha });
    }

    // POST /api/days — create or update day
    if (path === '/api/days' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { data, sha } = body;
        if (!data || !data.date) return json({ error: 'missing date' }, 400);

        const content = buildMDX(data);
        const res = await upsertDayToGitHub(env, data.date, content, sha);
        const resData = await res.json();

        if (!res.ok) {
          return json({ error: resData.message || 'GitHub error', status: res.status }, 500);
        }
        return json({ ok: true, sha: resData.content?.sha });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }


    if (path === '/api/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        const date = formData.get('date') || new Date().toISOString().slice(0, 10);

        if (!file) return json({ error: 'no file' }, 400);

        const ext = file.name.split('.').pop().toLowerCase();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
        const key = `media/${date}/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        await env.MEDIA.put(key, arrayBuffer, {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
        return json({ ok: true, url: publicUrl, key });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // GET /api/media/:date — list media for a specific date
    if (path.startsWith('/api/media/') && request.method === 'GET') {
      const date = path.replace('/api/media/', '');
      const list = await env.MEDIA.list({ prefix: `media/${date}/` });
      const urls = list.objects.map(o => `${env.R2_PUBLIC_URL}/${o.key}`);
      return json(urls);
    }

    // GET /api/media — list all recent media
    if (path === '/api/media' && request.method === 'GET') {
      const list = await env.MEDIA.list({ prefix: 'media/', limit: 50 });
      const urls = list.objects.reverse().map(o => `${env.R2_PUBLIC_URL}/${o.key}`);
      return json(urls);
    }

    return new Response('Not found', { status: 404 });
  },
};

// ── Simple MDX frontmatter parser ─────────────────────────────────────────────
function parseMDX(raw) {
  const parts = raw.split('---');
  if (parts.length < 3) return { body: raw };
  const fm = parts[1];
  const body = parts.slice(2).join('---').trim();

  function extract(key) {
    const m = fm.match(new RegExp('^' + key + ': "?(.*?)"?\\s*$', 'm'));
    return m ? m[1] : '';
  }

  function extractLangBlock(key) {
    const blockMatch = fm.match(new RegExp('^' + key + ':\\s*\\n((?:  \\w+:.*\\n?)*)', 'm'));
    if (!blockMatch) return {};
    const obj = {};
    const lines = blockMatch[1].split('\n');
    lines.forEach(line => {
      const m = line.match(/^\s+(\w+):\s*['"]?(.*?)['"]?\s*$/);
      if (m) obj[m[1]] = m[2].replace(/''/g, "'");
    });
    return obj;
  }

  function extractList(key) {
    const match = fm.match(new RegExp(key + ':\\s*\\n((?:    - .*\\n?)*)', 'm'));
    if (!match) return [];
    return match[1].split('\n')
      .filter(l => l.includes('- '))
      .map(l => l.replace(/^\s+- "?|"?\s*$/, ''));
  }

  const date = extract('date');
  const catsMatch = fm.match(/^categories: \[(.+)\]/m);

  // Facts SR
  const factsMatch = fm.match(/^facts:\s*\n(?:.*\n)*?\s+sr:\s*\n((?:\s+- .*\n?)*)/m);
  const factsSR = factsMatch
    ? factsMatch[1].split('\n').filter(l => l.includes('- ')).map(l => l.replace(/^\s+- "?|"?\s*$/, ''))
    : [];

  // Claims SR
  const claimsBlock = fm.match(/^claims:\s*\n([\s\S]*?)(?=^\w|\Z)/m);
  const claimsSR = [];
  if (claimsBlock) {
    const srBlock = claimsBlock[1].match(/\s+sr:\s*\n((?:\s+- [\s\S]*?(?=\s+\w+:|$))*)/m);
    if (srBlock) {
      const itemMatches = [...srBlock[1].matchAll(/- text: "?(.*?)"?\s*\n\s+disputed: (true|false)/g)];
      itemMatches.forEach(m => claimsSR.push({ text: m[1], disputed: m[2] === 'true' }));
    }
  }

  return {
    date,
    categories: catsMatch ? catsMatch[1].split(',').map(s => s.trim()) : [],
    important: fm.includes('important: true'),
    thumbnail: {
      src: extract('  src'),
      type: extract('  type') || 'foto',
      alt: extractLangBlock('  alt'),
    },
    title: extractLangBlock('title'),
    lead: extractLangBlock('lead'),
    facts: { sr: factsSR },
    claims: { sr: claimsSR },
    quotes: parseQuotesFromFM(fm),
    sources: extractSourcesFromFM(fm),
    body,
  };
}

function extractSourcesFromFM(fm) {
  const sources = [];
  const blocks = [...fm.matchAll(/- label: "?([^"\n]+)"?\n(?:\s+url: "?([^"\n]*)"?\n)?(?:\s+archiveUrl: "?([^"\n]*)"?\n)?(?:\s+reliable: (true|false))?/g)];
  blocks.forEach(m => {
    sources.push({
      label: m[1] || '',
      url: m[2] || '',
      reliable: m[4] !== 'false',
    });
  });
  return sources;
}
function parseQuotesFromFM(fm) {
  const quotes = [];
  const qBlock = fm.match(/^quotes:\s*\n([\s\S]*?)(?=^\w)/m);
  if (!qBlock) return quotes;
  const items = qBlock[1].split(/\n  - /).filter(s => s.trim());
  items.forEach(item => {
    const text = {};
    ['sr','en','de','fr','it','es'].forEach(l => {
      const m = item.match(new RegExp(`\\s*${l}:\\s*'((?:[^']|'')*)'`));
      if (m) text[l] = m[1].replace(/''/g, "'");
    });
    const attrBlock = {};
    const attrMatch = item.match(/attribution:\s*\n((?:\s+\w+:.*\n?)*)/);
    if (attrMatch) {
      ['sr','en','de','fr','it','es'].forEach(l => {
        const m = attrMatch[1].match(new RegExp(`\\s+${l}:\\s*'((?:[^']|'')*)'`));
        if (m) attrBlock[l] = m[1].replace(/''/g, "'");
      });
    }
    const verifiedM = item.match(/verified:\s*(true|false)/);
    if (Object.keys(text).length) {
      quotes.push({
        text,
        attribution: Object.keys(attrBlock).length ? attrBlock : {},
        verified: verifiedM ? verifiedM[1] === 'true' : false,
      });
    }
  });
  return quotes;
}
