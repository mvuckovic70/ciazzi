# ciazzi.com — Deploy Guide
## Stack: GitHub → Cloudflare Pages + R2 + custom domain

---

## 1. GitHub repo

```bash
cd ciazzi/
git init
git add .
git commit -m "init: ciazzi skeleton"
```

Idi na github.com → New repository → ime: `ciazzi` → Private (preporučeno) → Create.

```bash
git remote add origin git@github.com:YOUR_USERNAME/ciazzi.git
git push -u origin main
```

Zameni `YOUR_GITHUB_USERNAME/ciazzi` u `public/admin/config.yml`.

---

## 2. Cloudflare Pages

### 2.1 Nalog
https://dash.cloudflare.com → registracija (besplatno).  
Domen `ciazzi.com` prebaci na Cloudflare nameservere (objašnjeno u koraku 4).

### 2.2 Poveži repo
Cloudflare Dashboard → **Pages** → **Create a project** → **Connect to Git** → GitHub → autorizuj → izaberi `ciazzi` repo.

### 2.3 Build podešavanja
| Polje | Vrednost |
|-------|---------|
| Framework preset | **Astro** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (prazno) |
| Node.js version | `20` ← obavezno postavi pod Environment variables: `NODE_VERSION = 20` |

Klikni **Save and Deploy**. Prvi build traje ~2 min.

### 2.4 Automatski deploji
Svaki `git push` na `main` → CF Pages automatski rebuilda i deployuje.  
Preview deploji za svaki PR → možeš reviewovati pre merge.

---

## 3. Cloudflare R2 — storage za slike/video thumbove

R2 = S3-kompatibilan, **bez egress naplate** (ovo ubije budžet na AWS S3).

### 3.1 Kreiraj bucket
CF Dashboard → **R2** → **Create bucket** → ime: `ciazzi-media` → region: auto.

### 3.2 Custom domain za bucket
R2 bucket → **Settings** → **Custom domain** → dodaj `r2.ciazzi.com`.  
CF automatski kreira DNS record. Slike su dostupne na:  
`https://r2.ciazzi.com/media/2024-11-01/thumb.jpg`

### 3.3 Upload slika
**Opcija A — CF Dashboard** (za male količine): drag & drop u browser.

**Opcija B — rclone** (za bulk upload / skripte):
```bash
# Install rclone
brew install rclone  # ili apt install rclone

# Config (~/.config/rclone/rclone.conf):
[r2]
type = s3
provider = Cloudflare
access_key_id = ТВOJ_R2_ACCESS_KEY
secret_access_key = ТВOJ_R2_SECRET_KEY
endpoint = https://ТВOJ_ACCOUNT_ID.r2.cloudflarestorage.com

# Upload foldera
rclone copy ./lokalni-mediji/2024-11-01 r2:ciazzi-media/media/2024-11-01 --progress
```

R2 API tokene nađeš: CF Dashboard → R2 → **Manage R2 API tokens** → Create token (Object Read & Write za `ciazzi-media`).

### 3.4 Folder konvencija
```
ciazzi-media/
└── media/
    ├── 2024-11-01/
    │   ├── thumb.jpg        ← 800×450px, <150KB (WebP preporučeno)
    │   ├── 01.jpg
    │   └── 02.jpg
    ├── 2024-11-22/
    └── 2025-03-15/
```

### 3.5 Video
**Ne hostuj sam.** YouTube embed = besplatan, CDN, transkripcija, globalni reach.  
Kontrolisana alternativa bez reklama: **Cloudflare Stream** (~5$ / 1000 min).  
U MDX fajlu: `embedUrl: "https://www.youtube.com/embed/VIDEO_ID"`

---

## 4. Domen ciazzi.com → Cloudflare

### 4.1 Prebaci domen na CF nameservere
Kod trenutnog registrara (GoDaddy, Namecheap...) promeni NS na:
```
lara.ns.cloudflare.com
mike.ns.cloudflare.com
```
CF ti daje tačne NS kada dodaš domen: **CF Dashboard → Add a domain → ciazzi.com**.  
Propagacija: 5 min – 24h (tipično <1h).

### 4.2 Poveži Pages sa domenom
CF Pages → tvoj projekat → **Custom domains** → **Set up a custom domain** → `ciazzi.com` → Continue.  
CF automatski kreira `CNAME` record i izdaje SSL sertifikat (Let's Encrypt, auto-renewal).

Dodaj i `www` varijantu:
- DNS → Add record → CNAME → `www` → `ciazzi.com` → Proxied
- Pages → Custom domains → dodaj `www.ciazzi.com`

---

## 5. Decap CMS (vizuelni editor) — opciono

Za saradnike koji ne koriste git.

### 5.1 GitHub OAuth App
github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App:
- Application name: `ciazzi-cms`
- Homepage URL: `https://ciazzi.com`
- Authorization callback URL: `https://ciazzi.com/api/auth` ← CF Worker ispod

### 5.2 Cloudflare Worker za OAuth
Decap CMS treba server-side OAuth relay. Najlakše: deploy gotovog workera.

```bash
npm install -g wrangler
wrangler login

# Clone gotov relay:
git clone https://github.com/sveltia/sveltia-cms-auth
cd sveltia-cms-auth
```

U `wrangler.toml`:
```toml
name = "ciazzi-cms-auth"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
GITHUB_CLIENT_ID = "ТВOJ_CLIENT_ID"

[secrets]
# wrangler secret put GITHUB_CLIENT_SECRET
```

```bash
wrangler secret put GITHUB_CLIENT_SECRET  # unesi interaktivno
wrangler deploy
```

Worker URL (npr. `ciazzi-cms-auth.USERNAME.workers.dev`) ide u `public/admin/config.yml`:
```yaml
backend:
  name: github
  repo: YOUR_USERNAME/ciazzi
  branch: main
  base_url: https://ciazzi-cms-auth.USERNAME.workers.dev
```

### 5.3 Pristup editoru
`https://ciazzi.com/admin/` → login sa GitHub nalogom → vizuelni editor.

---

## 6. Dodavanje sadržaja

### Brzo (CLI)
```bash
# Novi dan
node scripts/new-day.mjs 2025-05-21 --cat pokret,policija --open

# Popunjavanje istorije (bulk)
for date in 2024-11-05 2024-11-10 2024-11-15; do
  node scripts/new-day.mjs $date --cat pokret
done

# Deploy
git add src/content/days/2025-05-21.mdx
git commit -m "dan: 21.05.2025 — [kratki opis]"
git push   # → CF Pages automatski deployuje za ~90s
```

### Vizuelno (Decap CMS)
`ciazzi.com/admin/` → New entry → popuni formu → Publish → CF deployuje automatski.

---

## 7. Troškovi (realni)

| Stavka | Cena |
|--------|------|
| CF Pages hosting | **$0** (neograničen bandwidth) |
| CF R2 storage | **$0** do 10GB, zatim $0.015/GB/mesec |
| CF R2 egress | **$0** (ovo ubije AWS S3) |
| SSL sertifikat | **$0** (automatski) |
| DDoS zaštita | **$0** (CF uključuje) |
| YouTube video hosting | **$0** |
| CF Stream (ako hoćeš bez YT) | ~$5 / 1000 min videa |
| **Ukupno realno** | **$0–5/mesec** |

---

## 8. Monitoring

CF Dashboard → Analytics → tvoj Pages projekat → real-time traffic, top countries, top pages.  
Bez Google Analytics — bez third-party trackera.

Za uptime alerting (besplatno): https://uptimerobot.com → monitor `ciazzi.com` → email/Slack alert ako padne.
