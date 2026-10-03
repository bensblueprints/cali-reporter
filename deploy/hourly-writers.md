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

Each writer uses sources from their assigned category. As of October 4, all new hourly output uses `lib/ai/reported-article.js`: **600–2500 visible words**, descriptive subheadings, source attribution, sanitized HTML and a separate factual review. Up to three draft attempts allow formatting/length repairs and one factual-review correction; review/provider/length failures never fall back to copied source text or short summaries. Historical short articles are not rewritten automatically.

The intake prioritizes full RSS article bodies over snippets, retaining whichever is longer between RSS and scraped text. At least 700 source words are required. Each job may inspect up to eight sources, but spends model calls on at most two sufficiently substantial candidates. Output typically targets 650–1800 words based on source length; 2500 is a ceiling, not a padding target. Longer articles still depend on actual source material, not invented context.

Claims rotate by category attempt count within the current hour, then oldest publication by category, then writer attempts and last publication. This prevents early writer IDs and large desks from occupying every turn. A production-database clone verified 13 distinct categories in the first 13 claims. It does not establish 35 successful articles per hour or guarantee a publishable story in every category on every run.

`deploy/hourly-feeds.json` records the complete 13-category feed configuration, including tested PsyPost relationship coverage, OPB West Coast coverage, and LA Times/Mission Local city backups and KPBS/Voice of San Diego full-text feeds. Merge additions with live feeds rather than dropping later changes.

Use `node scripts/audit-hourly-coverage.js --since=2026-10-03T18:07:00Z` to report coverage, word counts and queue states by category. It includes zero-publication categories. Earlier reports legitimately include old short briefs; use the deployment timestamp when validating the new length rule.

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
endpoint, and AI image generation. No GPU/kernel changes were made.

Follow-up verification: a second live two-job run published post 3957 at
2026-10-03T16:20:32.052Z, then exited with status 0 and released the flock.
The existing image-provider wrapper fell back to Unsplash after ComfyUI's 502;
thus the image outage degrades custom images but does not block all publishing.
The public article and fallback hero returned HTTP 200. The article includes
DeShawn Carter's byline and NewsArticle metadata. Automatic scheduling remains
enabled; this proves recovered publication, not sustained 35-article/hour output.

Rollback files and original cron: `/opt/cali-autoblog-backup-20261003`.
Prior image: `cali-reporter:before-autoblog-fix-20261003`. Preserve unrelated
cron entries and published data when rolling back. Restoring the prior worker
without the timeout would reintroduce the lock-retention risk.

### GPU repair, October 3 at 16:55 UTC

Administrator access was provided and the driver dependency was repaired on
`5060ti-images`. The initial matching-version DKMS module built successfully,
but Secure Boot rejected its signing key. Replaced that DKMS driver with
Canonical-signed `linux-modules-nvidia-595-open-7.0.0-34-generic` and matching
NVIDIA 595.91.07 userspace packages. Updated the NVIDIA HWE module meta-package
to `7.0.0-34.34~24.04.1+1`. No newer kernel was installed and no reboot was
performed; Secure Boot remains enabled. NVIDIA kernel modules loaded and
`nvidia-smi` reported the RTX 5060 Ti with 16 GiB VRAM.

Restarted the existing `comfyui-tailscale` user service. The public
`https://images.onetimesuite.com/system_stats` endpoint returned HTTP 200 and
reported the CUDA GPU. Package-install evidence is retained on the image host
at `/var/log/cali-gpu-driver-repair-20261003.log`. Future kernel upgrades should
include the matching signed NVIDIA modules before booting the new kernel.

An actual Krea image job invoked from the production CaliReporter container
completed successfully at 16:58 UTC and saved
`/uploads/20261003165808-gpu-recovery-20261003-33ca7673.webp`.
This verifies the production-to-public-tunnel-to-GPU generation and image-store
path, rather than only endpoint health. The GPU blocker above is resolved.

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
