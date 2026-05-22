# ciazzi-admin deploy

## 1. Instaliraj i deplouj

```bash
cd ~/projects/ciazzi/ciazzi-admin
npm install
npx wrangler deploy
```

## 2. Postavi environment variables (jednom)

```bash
npx wrangler secret put ADMIN_PASSWORD
# unesi lozinku koju ćeš koristiti za admin

npx wrangler secret put GITHUB_TOKEN
# unesi novi GitHub token

npx wrangler secret put GITHUB_OWNER
# mvuckovic70

npx wrangler secret put GITHUB_REPO
# ciazzi

npx wrangler secret put GITHUB_BRANCH
# main

npx wrangler secret put R2_PUBLIC_URL
# https://r2.ciazzi.com
```

## 3. Dodaj custom domain

CF Dashboard → Workers & Pages → ciazzi-admin → Domains → Add Domain → admin.ciazzi.com

## 4. Pristupi

https://admin.ciazzi.com → unesi lozinku → gotovo
