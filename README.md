# Cali Reporter

Magazine-style daily for **calireporter.com** — covering U.S. national headlines, California politics and culture, and West Coast business.

Stack: Next.js 14 (App Router) + Tailwind + SQLite (better-sqlite3) + provider-agnostic AI adapter (Anthropic / OpenAI / Replicate / fallback). Deploys to Coolify (Contabo VPS 2) behind Traefik.

---

## 1. Local development

```bash
npm install
cp .env.example .env.local
# fill in ADMIN_JWT_SECRET, ADMIN_PASSWORD_HASH, ANTHROPIC_API_KEY, REPLICATE_API_TOKEN
npm run db:init
npm run dev
# → http://localhost:3000
# → Editor at http://localhost:3000/admin/login
```

### Generate secrets

```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Password hash
node deploy/generate-password-hash.js 'YourStrongPassword'
```

### Smoke test the aggregator without API keys

```bash
npm run aggregate:dry        # prints what would be inserted, no API calls
AI_TEXT_PROVIDER=none AI_IMAGE_PROVIDER=none npm run aggregate
```

## 2. AI providers

`AI_TEXT_PROVIDER` and `AI_IMAGE_PROVIDER` are independent. Failures fall back to `none` so the pipeline never blocks.

| Provider     | Text   | Image | Env keys                                    |
|--------------|:------:|:-----:|---------------------------------------------|
| `anthropic`  | ✓      |       | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`      |
| `openai`     | ✓      | ✓     | `OPENAI_API_KEY`, `OPENAI_MODEL`            |
| `replicate`  |        | ✓     | `REPLICATE_API_TOKEN`, `REPLICATE_MODEL`    |
| `none`       | local  | Unsplash | (no keys)                                |

Production default: `anthropic` (text) + `replicate` flux-schnell (image).

## 3. Deploy (Coolify, Contabo VPS 2)

Standard pattern from `Coolify Deployment Spec`:

```bash
# Push
cd C:\Users\HP\cali-reporter
git add -A && git commit -m "deploy" && git push

# Deploy on server
ssh -i ~/.ssh/id_server212 root@212.28.184.24 \
  "cd /opt/cali-reporter && git pull && docker compose up -d --build"
```

Domain: `calireporter.com` (apex + www). Cloudflare A-records to `212.28.184.24`, proxied. Traefik handles TLS via Let's Encrypt.

## 4. Cron (3×/day aggregator)

See `deploy/crontab.example`. After first deploy:

```bash
ssh -i ~/.ssh/id_server212 root@212.28.184.24
crontab -e
# Paste contents of deploy/crontab.example
```

## 5. Layout

```
app/
  page.jsx                 Front page
  category/[slug]/         Section pages
  article/[slug]/          Article pages
  about/                   About page
  rss.xml/                 RSS feed
  admin/login              Editor sign-in
  admin/page.jsx           Editor dashboard
  admin/new                New post
  admin/edit/[id]          Edit post
  api/admin/*              Admin-only API
components/                Header / Footer / ArticleCard / CategoryStrip / PostForm
lib/
  db.js                    SQLite layer
  auth.js                  bcrypt + JWT
  ai/                      Provider-agnostic adapter
  format.js, image-store.js
scripts/
  db-init.js               Initialize DB + seed welcome post
  aggregate.js             RSS pull + AI rewrite + image gen
deploy/
  generate-password-hash.js
  crontab.example
Dockerfile                 Next.js standalone, non-root, with /app/data + /app/public/uploads volumes
docker-compose.yml         Traefik labels for calireporter.com, persistent volumes
feeds.json                 RSS sources, category mapping
```

## 6. License & content

This project rewrites source articles in-house, attributes the original publication, and links back to the original. That is a low-risk pattern but is not a substitute for legal review. Newsmax content is copyrighted; treat as "summary + commentary + link," not republication.
