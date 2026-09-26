# CaliReporter image optimization

Run from the application directory with Node 20+ and dependencies installed:

```sh
npm run images:optimize                 # dry run: no image/DB changes
npm run images:optimize -- --apply --warm
npm run test:images
```

The batch scans every nonempty `posts.hero_image`, `authors.headshot` and
`share_queue.cover_image` reference. It deduplicates shared URLs, converts local
PNG/JPEG files and the site's existing images.unsplash.com fallbacks to WebP,
limits masters to 1280px, and pre-generates 80/160/320/640/960/1280px variants.
Other remote hosts and unsupported image types are reported, not fetched.
SVGs and animated GIFs are intentionally not flattened. New image-store uploads
are automatically converted before their URL is returned to the publisher.

Apply mode creates a consistent online SQLite backup plus a JSONL mapping under
`data/image-optimization/`. It retains existing originals and updates references
only when they still equal the inspected URL, preserving concurrent publisher
updates. Each image is committed separately, so rerunning resumes safely. Already
WebP references are skipped for conversion but can have their cache warmed again.
Errors are reported per URL and cause a nonzero exit; remaining images continue.
No article text, titles, dates, author identities or source attribution is changed.

Variants are persisted under `data/image-cache/v1/` (the existing data volume),
with two concurrent encodes and bounded pending jobs. Only local raster filenames
and six widths are accepted. Errors are no-store; successful image responses have
one-year public browser/CDN TTLs and strong ETags. Hero images are eager/high
priority; other editorial images use responsive sizes and lazy loading.

## Deployment and rollback

Production is `/opt/cali-reporter` on the existing Coolify host, not a new site.
Before release, preserve its source and tag the current Docker image. Build, run
an isolated canary, then recreate only the `cali-reporter` service. The batch can
run in a separate resource-limited container with the same data/uploads volumes.

For an image-reference rollback, read the JSONL mappings in reverse and replace
`newUrl` with `oldUrl` only where the current value still matches `newUrl`, in each
of the three columns above. Do not restore the entire database over newer articles.
Original upload files remain available; imported Unsplash references can revert
to their original URLs. The old application also serves the new WebP masters.

The origin has substantial earlier, uncommitted newsroom changes absent from
GitHub main. This commit preserves those edits on the server and adds the same
image optimization to the checked-in pages. `image-integration.patch` records the
exact additional image-only edits applied to the live-only author/byline/infinite
scroll/ad components. Do not deploy an unreviewed clean checkout over that newer
live source. No private .env, proxy credentials, database or runtime images belong
in GitHub.

## Cloudflare

The calireporter.com apex currently resolves directly to its origin. Enable the
Cloudflare orange-cloud proxy for apex and www; retain the origin address and use
Full (strict) TLS. WebP/PNG/JPEG and other static extensions are cacheable by default.
The origin TTLs cover `/uploads/`, `/media/v1/` and content-hashed WebP ads; avoid
cache-everything rules on HTML, `/admin/` or `/api/`. Verify repeated image GETs
return `CF-Cache-Status: HIT` and an `Age` header before claiming edge caching.
The saved token could read the zone, but DNS and cache-rule writes were denied.

References:
- https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- https://developers.cloudflare.com/dns/proxy-status/
