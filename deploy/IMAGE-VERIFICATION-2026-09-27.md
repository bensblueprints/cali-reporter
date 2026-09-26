# Image optimization verification — 2026-09-27 (Asia/Bangkok)

Database migration verified on production:

| Reference | Total | WebP | Missing |
| --- | ---: | ---: | ---: |
| Article heroes | 3,872 | 3,872 | 0 |
| Author portraits | 30 | 30 | 0 |
| Share queue covers | 1 | 1 | 0 |

1,421 distinct source URLs converted, including four shared Unsplash fallbacks.
Original referenced source bytes: 1,387,836,333. WebP master bytes: 113,818,928.
Reduction: 91.8%. This is transfer-size reduction, not deletion of original disk
files. Original files and online SQLite backups remain available. New publisher
images are converted before insertion; counts can increase after this audit.

Three tests passed: bounded local URL conversion; output dimensions/format,
cache reuse and simultaneous request deduplication/path/symlink rejection; full
SQLite batch dry run/apply/backup/reference updates/idempotency. Next.js production
builds passed for the live source and checked-in source. HTTP checks verified
WebP responses, one-year immutable browser/CDN headers, strong ETag 304 behavior,
invalid width 400, missing image 404 and retained admin redirect/API behavior.

An actual new upload was generated from a 1600px fixture, saved as WebP1280,
requested successfully through the running server and then removed. No database
fixture was inserted. Headless Chromium homepage/article checks at 390px and
1440px widths found no failed images or horizontal overflow. Below-fold images
are lazy; the lead image is eager/high priority. Banner widths retain enough
pixels for high-density displays while preserving original artwork proportions.

A sampled article source (1,095,411-byte PNG) became a 53,052-byte full-width
WebP variant or 3,270-byte 160px thumbnail. Derivatives are retained in the data
volume and generated once per source/width, with bounded CPU concurrency.

Cloudflare edge caching is **not yet verified/enabled**: public apex DNS still
resolves directly to the origin. The saved API token can read the zone but is
not authorized for DNS access or cache-rule writes. Next action: enable proxied
(orange-cloud) apex/www records or provide scoped DNS edit access, then verify
repeated public image GETs produce `CF-Cache-Status: HIT`. Origin cache readiness
does not prove a Cloudflare cache hit.

Production rollback image: `cali-reporter:before-image-optimization-20260927`.
Source backup: `/opt/cali-image-backup-20260927/source.tgz` (private, includes
runtime configuration; never publish it). Database backups/audit mappings live
inside the existing data volume at `image-optimization/`. Use conditional reverse
URL updates for image rollback so later articles are not lost.
