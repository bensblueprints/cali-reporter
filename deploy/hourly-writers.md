# Hourly writer publishing — 2026-09-27

Ben requested one category article per writer per hour and removal of “AI writer” from the visible byline subtitle. Default scope is all 35 named writers: the 30 existing staff/columnists plus five city writer identities. The two generic health/relationships desk profiles are excluded. `--scope=cities` restricts to the five named city writers.

City bylines now show the city alone; author bios and generated article attribution retain accurate AI disclosure. Existing names, author IDs and URLs are unchanged. The migration is `node scripts/name-city-writers.js --apply`, which creates an online SQLite backup.

## Runtime

This worker requires the production newsroom database schema (authors and article author IDs); the older main-branch scaffold is not a complete production snapshot. Preserve the newer live source when deploying.

`node scripts/hourly-writers.js --dry` lists the roster without publishing.

`node scripts/hourly-writers.js --enqueue-only` creates this UTC hour's durable slots without calling models.

`node scripts/hourly-writers.js --max-jobs=12 --budget-seconds=240 --concurrency=2` processes pending slots. Two inference jobs may run together. The budget limits starting new work; an already-started source/model/image request may finish later. Per-request text/image timeouts are 120 seconds; existing provider retries may extend total job duration.

Cron polls every five minutes under the existing aggregate flock. Each named writer gets one slot per UTC hour, 24/7. The old aggregate/column/Reddit publication cron entries are superseded by this schedule, with their exact previous configuration backed up. Other cron entries are preserved.

An existing article by that author in the same hour satisfies the slot. A transactional final check prevents a second publication, enforces the writer's assigned category, and ties the inserted post to the completed job. Source URL/GUID deduplication and temporary source reservations prevent concurrent reuse of the same report.

A failed job retries after five minutes, up to three attempts per hour. Each attempt tries at most two candidate reports. Running jobs renew a lease; interrupted workers can be recovered. Unfulfilled slots expire at the hour boundary rather than building an unlimited backlog. This is an hourly publication target, not a guarantee of 35 successful articles every hour. No source, failed factual review or unavailable models can leave a slot unfilled. Inspect the recorded statuses before reporting actual output.

## Content

Each writer uses sources from their assigned category. All hourly output takes the strict source-linked rewrite path, including factual review and HTML sanitization. It currently produces short sourced news briefs; this schedule does not promise long-form essays or original on-scene reporting.

City articles use Google News RSS headline overlap as a current-coverage signal, followed by recency; this is not audience-popularity measurement. Only eligible local publisher items from the last 72 hours are used for city coverage. Trend-feed failures fall back to recent local reports. Publisher feeds were reachable from production on September 27: KTLA, Times of San Diego, San Jose Spotlight, SF Standard and Fresnoland. Fresh candidate supply was limited in some cities.

Source bodies stay transient. The database stores the reviewed article, publisher credit, source URL and GUID. No historical published articles or third-party originals are deleted. The earlier pending local-RSS integration patch remains historical; this worker consumes the local-news helper directly and does not require that patch against the older importer.

## Monitoring and rollback

### October 3 incident and recovery

The September 27 validation worker completed its two jobs and logged
`run-complete`, but its Node process stayed alive with a referenced handle.
The exact library owning that handle was not established. Its host `flock`
remained held for six days, causing every five-minute cron invocation to skip.
Last publication before investigation: post 3956, September 27 at 12:48:46 UTC.

The worker now flushes stdout/stderr and explicitly exits only after all jobs
settle and SQLite closes. `tests/worker-exit.test.mjs` reproduces a lingering
handle and checks both process exit and complete log output. All 14 targeted
tests pass. Install the line in `deploy/hourly-writers.cron`, replacing only the
existing hourly writer line. Its 20-minute timeout runs **inside** the container,
so it terminates the actual Node process; a host-only docker-client timeout
would not provide that guarantee. SIGKILL follows TERM after 30 seconds if needed.

Production source and running-container files were updated; the image was
rebuilt successfully with matching worker/helper SHA256 hashes. Only the
identified completed September 27 process was terminated. A subsequent live
two-job run enqueued 35 current-hour slots, rejected both drafts through existing
review rules, exited with status 0, and released its flock. No new publication
was verified during that run. Do not equate recovered scheduling with recovered
end-to-end publishing.

A separate current dependency failure remains: `images.onetimesuite.com`
returns HTTP 502. Its tunnel targets localhost:8188 on the 5060 Ti image host.
That host runs kernel `7.0.0-34-generic`, with NVIDIA modules found only for
`7.0.0-31-generic`; `modinfo nvidia` fails and `nvidia-smi` cannot communicate
with the driver. ComfyUI repeatedly exits with `No CUDA GPUs are available`.
The existing SSH account cannot use passwordless sudo. An administrator must
restore a compatible NVIDIA driver for the running kernel (or deliberately
boot the known driver-equipped kernel), then verify ComfyUI, the public image
endpoint, and an actual scheduled article. No GPU/kernel changes were made.

Rollback files and original cron: `/opt/cali-autoblog-backup-20261003`.
Prior image: `cali-reporter:before-autoblog-fix-20261003`. Preserve unrelated
cron entries and published data when rolling back. Restoring the prior worker
without the timeout would reintroduce the lock-retention risk.

- Log: `/var/log/cali-reporter-hourly-writers.log`.
- SQLite: `hourly_writer_jobs` (author, hour, state, attempts, post, error) and `hourly_source_claims`.
- Test: `node --test tests/hourly-jobs.test.mjs tests/section-coverage.test.mjs tests/local-news.test.mjs`.
- Source/cron backup: `/opt/cali-hourly-backup-20260927`.
- Image rollback: `cali-reporter:before-hourly-writers-20260927`.
- Restore only the saved relevant publication cron lines, preserving concurrent cron edits. Retain new published articles and queue audit data; do not roll back the whole live database.

## Release verification

- Thirteen scheduler, section and local-news tests passed; production Next.js build passed.
- Dry run enumerated all 35 named writers and assigned categories.
- Five city publisher RSS feeds and five city Google News feeds fetched successfully from production.
- A bounded live test rejected an invalid draft, then published Los Angeles article ID 3955 under Maya Chen. Its public page, source attribution, NewsArticle author/category fields and HTTP 200 WebP hero were verified.
- All five city profiles show clean city subtitles and retain profile disclosure.
- Cron service is active; all 35 current-hour slots were created. Full sustained output of 35 approved articles per hour has not been demonstrated. Feed and model failures are recorded in queue state and logs.
