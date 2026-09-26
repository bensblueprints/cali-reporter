# Seven-section coverage deployment

Adds openly AI-assisted desk writer identities for Los Angeles, San Diego, San Jose, San Francisco, Fresno, Health & Nutrition and Love & Relationships. Seven reviewed, original launch explainers cite city, FDA and NIH guidance and publish once, with actual insertion timestamps. No fictional credentials or headshots are used.

The live newsroom source predates this task and has substantial changes absent from the legacy main scaffold. Preserve that live tree. `section-coverage-integration.patch` records only this task's edits to the live importer, fleet adapter, feeds and author profile; apply with `git apply --check --unidiff-zero` then `git apply --unidiff-zero` against the pre-change production tree, not legacy main. Copy the added lib/scripts files and updated lib/news-schema.js from this commit. The importer requires the existing production authors table and posts.author_id, which are intentionally not replaced. No credentials, article database or unrelated live changes are checked in.

## Behavior

- Sort categories by oldest most recent publication, empty categories first; interleave feeds by category and accept at most one post per feed per run. Existing daily cap and Pacific publishing window remain in force.
- Add five city RSS sources, relevance filters and a 14-day feed freshness window. Relationships feed entries must match relationship topics.
- Prefer the seven desk writers for their categories. Existing columns and authors remain.
- New desk briefs use LOCALFLEET_MODEL_SECTION (default huihui_ai/qwen3-coder-next-abliterated:latest), verified on the configured fleet. They use short original summaries, source attribution, sanitized HTML, a separate source-based factual review that must approve each draft, and an AI disclosure. Direct quotation drafts are rejected. Generated image captions identify illustrations. Provider or factual-review failure skips the article rather than publishing copied source sentences.
- Desk author metadata uses Organization rather than Person. Masthead counts show the actual sections; portrait generation excludes desk identities.
- Compose mounts feeds.json read-only so feed configuration updates persist without rebuilding the application.

## Deploy and validate

1. Snapshot the live database with better-sqlite3 backup; save edited source, crontab and current Docker image.
2. Apply the integration patch and copy added files. Run `node --test tests/section-coverage.test.mjs tests/news-schema.test.mjs` with project dependencies. On the integrated production source, also run `node --test deploy/section-review.test.mjs` for factual-review rejection/acceptance checks.
3. `docker compose build cali-reporter` then `docker compose up -d --no-deps cali-reporter`.
4. `docker exec cali-reporter node /app/scripts/publish-section-launch.js --dry` to review; omit --dry to publish the seven idempotent launch posts.
5. Preserve the every-30-minute cron and protect against overlap: `*/30 * * * * flock -n /run/lock/cali-reporter-aggregate.lock docker exec cali-reporter node /app/scripts/aggregate.js >> /var/log/cali-reporter-aggregate.log 2>&1`.
6. Inspect selection without writes using `docker exec cali-reporter node /app/scripts/aggregate.js --dry --category=los-angeles`. A controlled live check can use --force with AGGREGATE_MAX_PER_RUN=1. Force bypasses daily pacing and should not be added to cron.
7. Check all seven section, article and author URLs, persisted source links, desk bylines and structured data. An actual future publication still depends on source availability and fleet services.

## Rollback

Production pre-change source and crontab: /opt/cali-section-backup-20260927. Image: cali-reporter:before-section-coverage-20260927. Consistent DB snapshot in the persistent data volume: before-section-coverage-20260927.db. Restore the image/source to roll back code. Do not blindly restore the database over posts published since the snapshot; launch posts are identified by source_guid prefix calireporter:section-launch: for selective editorial review.
