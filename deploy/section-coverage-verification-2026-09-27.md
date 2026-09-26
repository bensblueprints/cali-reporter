# Seven-section publishing verification

Verified 2026-09-27 Asia/Bangkok (2026-09-26 UTC).

- Seven disclosed AI-assisted desk profiles created, one for each requested section. The masthead displays 37 writer/desk profiles across 13 sections and links all seven new profiles.
- Seven original, primary-source launch explainers published at 2026-09-26T23:02:09Z. All seven category pages, seven article pages and seven author pages returned HTTP 200 after final deployment. Each launch article appears on its category and author pages, includes its source link, and has NewsArticle metadata identifying its desk as an Organization.
- Two additional importer stories published: Los Angeles post 3910 and San Jose desk post 3911. Final new-desk counts: LA 2, SD 1, SJ 2, SF 1, Fresno 1, Health 1, Relationships 1 (nine articles total).
- Editorial review caught unsupported details in post 3910 and a misattributed quote in post 3911. Both were corrected with visible correction notes. New briefs now permit shorter output for short sources, require a separate source-based factual review, reject direct quotations, sanitize model HTML, disclose AI assistance, and label generated images as illustrations. Automated review reduces risk but does not guarantee factual accuracy; these failures demonstrate the value of human editorial review.
- Final runtime source hash for lib/ai/localfleet.js matches the deployed host source: ea1833d7e75e5acea21148b5bbb7b0cad425b06d48d995d7ed94b84fb152dea8.
- Eight repository tests passed for feed fairness/freshness, HTML sanitization, idempotent launch publishing, metadata and sitemaps. Three fleet adapter regression tests cover rejected unsupported drafts, accepted short sourced briefs and rejection of direct quotations.
- Production Next.js build passed. Final CLI-only review adjustment was layered onto that built image; source tree contains the same change for future full builds. The final container was recreated and verified. The feeds.json bind mount is read-only.
- Existing 30-minute cron remains enabled with flock protection. Actual configured daily target is 250; Pacific publishing window and pacing remain unchanged. A dry run reached candidates in all five new city feeds. Health/Relationships feeds fetched but their qualifying current entries were already imported. Several unrelated legacy feeds timed out or returned invalid/blocked responses; the importer continued to other feeds.
- Existing Cloudflare permissions blocker from the earlier image/cache task is separate and unchanged.

## Published launch articles

- https://calireporter.com/article/los-angeles-myla311-city-service-guide
- https://calireporter.com/article/san-diego-get-it-done-neighborhood-reports
- https://calireporter.com/article/san-jose-311-report-track-city-services
- https://calireporter.com/article/san-francisco-311-city-information-guide
- https://calireporter.com/article/fresno-fresgo-311-neighborhood-service-guide
- https://calireporter.com/article/added-sugars-total-sugars-nutrition-label-guide
- https://calireporter.com/article/healthy-relationship-communication-boundaries-nih
