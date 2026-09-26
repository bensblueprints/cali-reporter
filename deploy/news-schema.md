# News schema and sitemap deployment

Every article uses lib/news-schema.js at render time. Existing and future posts automatically receive NewsArticle JSON-LD, canonical URLs, publisher/author attribution, UTC dates, social metadata and large image preview eligibility. Actual publication dates are preserved. Source citations are retained; this change does not rewrite or delete articles.

/sitemap.xml indexes the complete archive in 1,000-article pages plus static/author/category pages. /sitemap-news.xml indexes only articles published within the last 48 hours, also in pages of at most 1,000. All sitemap responses read current database contents and permit caching for 1,800 seconds (30 minutes). No external sitemap service or scheduled generation is required. Scheduled future articles are excluded until their publication time. Search engines choose their own fetch/index timing.

Validation: node --test tests/news-schema.test.mjs. Read-only full database audit: DATABASE_PATH=/app/data/cali-reporter.db node scripts/audit-news-schema.js.

The production deployment contains pre-existing newsroom source changes not present on main. deploy/news-schema-integration.patch is a zero-context patch (git apply --unidiff-zero) recording only the article/author template integration against the production source before this update. Do not replace that production tree wholesale with main or apply this patch to the older main templates. The main article template is integrated separately in this commit.

Deployment rollback: restore the pre-change source backup and image tagged cali-reporter:before-news-schema-20260927. No database migration is involved.
