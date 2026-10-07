# CaliReporter publishing recovery — October 7, 2026

## Current status

Primary scheduled publishing is restored on Justin's host using a dedicated
Gemma4 26B service. Consecutive scheduled runs published articles 3980 and 3981
at 15:46 and 15:55 UTC; both public pages and images were verified. The 16:00
run also began automatically. Mac mini failover code is deployed but remains
disabled pending Mac account access and a live private-route/model test. The
Mac is reachable on the LAN but SSH reports a locked system/access denial.
See the final activation section for current configuration and rollback.

## Incident

At the start of this investigation the five-minute cron was active, but only one
article had published in the preceding 24 hours: post 3979, at October 6,
20:18:36 UTC. The earlier lingering-process/flock fault was not recurring.
The accumulated writer log contained 1,580 HTTP 524 errors, 2,333 quotation-limit
failures and 2,514 insufficient-source failures, versus four publications in
400 runs. Those totals cover the retained log, not just the preceding day.

The shared local inference server queued even a tiny request for 84 seconds
before its first streamed byte. Longer quiet requests timed out through the
public proxy. Provider errors then entered the three-attempt editorial revision
loop, multiplying requests that could not repair the outage. Rejected sources
were immediately released and selected again by other writers.

The configured coding model also repeatedly produced short or excessively
copied drafts. Infrastructure recovery alone does not establish that the model
can consistently satisfy the editorial requirements or meet the publication
target. Do not report 24/7 successful publication from a healthy cron alone.

## Changes

- Add a loopback SSE relay that responds immediately and sends ten-second
  heartbeats while Ollama queues work. Requests still have a 240-second limit.
  Client cancellation closes the upstream request; upstream failures become
  explicit stream errors. Only streaming chat completions are accepted.
- Route `/cali/*` through the existing authenticated Caddy handler. Other model
  clients retain their existing route. No model API key is stored in the relay.
- Reduce CaliReporter's cron concurrency to one. Keep the existing flock,
  five-minute polling, durable jobs and container-side 20-minute timeout.
- Stop immediate editorial retries for inference/transport outages. Cool down
  failed source URLs across writers and hours; retain failure evidence.
- Add timestamps and make the paraphrase instructions explicit. Preserve the
  600–2500-word gate, source-length requirement, attribution, copied-text and
  quotation checks, and independent factual-review call.

No paid writing fallback has been enabled. Ben subsequently selected his Mac
mini as the fallback; its activation requirements are below. No unrelated model
jobs were stopped or shared Ollama settings changed.

## Relay deployment

On the existing inference host, the relay script is installed at
`/home/ben/ai/cali-inference-relay/inference-heartbeat-proxy.mjs`.
`inference-relay.compose.yml` describes the container. This host currently lacks
the Compose plugin, so the equivalent deployment used:

```sh
sudo docker run -d --name cali-inference-relay --restart unless-stopped \
  --network host --user node --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --memory 128m \
  -v /home/ben/ai/cali-inference-relay/inference-heartbeat-proxy.mjs:/app/inference-heartbeat-proxy.mjs:ro \
  node:22-alpine node /app/inference-heartbeat-proxy.mjs
```

The relay listens only on `127.0.0.1:11436`, forwarding to local Ollama on 11434.
Inside Caddy's **existing authenticated handler**, the routing is:

```caddyfile
handle_path /cali/* {
    reverse_proxy 127.0.0.1:11436
}
handle {
    reverse_proxy 127.0.0.1:11434
}
```

Do not install this fragment outside authentication or publish the loopback
relay port. Validate and reload the existing Caddy container after changes.
The original Caddy configuration is backed up on that host at
`/home/ben/ai/caddy/Caddyfile.before-cali-recovery-20261007`; it contains credentials
and must stay out of source control.

## Application deployment and rollback

Production has newer application code than the public scaffold. Preserve it.
The running container also had five JavaScript files newer than its original
image: `lib/ai/reported-article.js`, `lib/hourly-jobs.js`, `lib/worker-exit.js`,
`scripts/audit-hourly-coverage.js` and `scripts/hourly-writers.js`.
The recovery image layers all five over the exact prior application image,
preserving the serving build and older process-exit/coverage repairs. This
change does not require rebuilding the unchanged Next.js frontend.

Production source, cron and Compose backups are in
`/opt/cali-autoblog-backup-20261007` on the hosting server. The persistent volume
contains an online SQLite backup at `/app/data/pre-recovery-20261007.db`.
The Docker build context is `/opt/cali-recovery-stage-20261007`; the deployed
Compose image is `cali-reporter:recovery-20261007`.

The prior image tag is `cali-reporter:before-recovery-20261007`, but that image
alone does **not** contain the earlier runtime-only fixes. For a rollback, retain
the preserved worker-exit/audit helpers, restore only the three affected source
files from the backup, and build another layer before recreating the service.
Restore only the writer cron entry, preserving unrelated schedules. Keep newer
articles and queue data; do not restore the entire database over newer work.
The added cooldown table is compatible with the previous worker.

To remove the relay, first point the writer back to its previous base URL, then
restore Caddy's original routing while preserving any subsequent unrelated
changes, validate/reload Caddy, and remove only `cali-inference-relay`.

## Verification

- All 36 repository tests passed, including delayed upstream headers,
  heartbeats, explicit upstream errors, client cancellation, persistent source
  cooldowns, provider retry behavior and existing editorial/queue safeguards.
- Caddy validation/reload passed. Public `/cali/health` returned 401 without
  authentication and 200 with the application's existing key.
- A real production-to-relay-to-model JSON request received response headers in
  0.442 seconds and completed successfully after 177.61 seconds. This establishes
  that a queued request can survive the previous quiet-connection failure.
- The recovery image dry run enumerated all 35 writers across 13 categories.
- The resumed five-minute cron started the updated worker automatically at
  11:50 UTC. It reached model generation and rejected a 549-word draft. This
  verifies scheduling and the length gate, not a successful publication.
- That scheduled run ended at 12:01:32 UTC after later model requests exceeded
  the 240-second deadline. It released its lock normally. The service was then
  recreated from the recovery image at 12:01:35 UTC; all five preserved/updated
  JavaScript files match the repository and production source. The active image
  is `sha256:81b7dcc83b2f6d5f9380121dc352c9cf819b3c3fc8a8fb15c59e2d99ffb04d1d`.
  The public homepage returned HTTP 200 after recreation. The relay is running
  with `restart=unless-stopped`, and its deployed script hash matches the repo.
- SQLite contains the new source cooldown records. The post-deployment audit
  still shows zero new articles. An isolated, unpublished canary using the
  already-installed Llama 3.3 model also hit the 240-second deadline at 12:03 UTC.
  A prior GLM canary did likewise. Neither alternate was selected for production.

At this earlier stage, publication recovery remained unverified until a fresh scheduled job passed
generation, review, image handling and database insertion and its public page
is checked. The shared model's queue and repeated rejected drafts remain the
throughput constraint. Inspect the timestamped writer log and run
`node scripts/audit-hourly-coverage.js --since=2026-10-07T11:50:00Z` to measure
actual post-deployment output.

The dependency at that stage was usable inference capacity. The next action was to
validate a dedicated local writing endpoint/model without displacing other
workloads, then repeat a complete scheduled-publication verification. The Mac
mini is the selected fallback. No paid provider is called by this repair. The
scheduler remains enabled with bounded retries and cooldowns.

## Ongoing local writing validation

A separate loopback-only Ollama test service was started on the existing
inference host at port 11437, with one request/model, an 8192-token context,
8 GiB host-memory high watermark, 12 GiB host-memory limit, no swap and nice 10.
GLM Flash fitted in about 18,027 MiB of GPU memory, leaving about 9,820 MiB free
at load; the existing Ollama service remained active. This establishes a viable
local allocation for testing, not a production publishing recovery. The test
service is a transient user unit named `cali-ollama-probe`.

Unpublished generation tests found extensive source copying. A factual-note
step and a constrained section/paragraph response produced a 795-word draft in
about one minute, but it still contained 185 copied words and was rejected.
The application now identifies the actual matching passages in repair feedback,
while retaining exactly the existing eight-word-span detection and 25-word
limit. Grouping and correction-feedback regression tests cover this change.
The writing experiment is not yet wired into production.

Imported raw templates prompted an instruction-delivery investigation. A
stronger sentinel test showed system text does reach the model, so do not claim
that dropped system messages caused the failures. A Cali-only model alias was
created for testing; shared models were not overwritten. Another SSH client
was observed sending native chat requests to the temporary endpoint; its work
was not interrupted, and coordination was requested before any service restart.

At 13:10 UTC the exact-passage feedback update was deployed under the writer's
existing lock, after a syntax check of the new image. It is layered over the
recovery image as `cali-reporter:feedback-20261007`, image
`sha256:b821ae504b0dd5e89d02cf1416fcaea38587231e4d8cc31dfcb2cf015654e226`.
The production source and container file both match SHA-256
`cb1e7b300b812533801aee7807042b358eeae83f3c4ecfbd9a2afb0969ed8514`.
Pre-update source/Compose copies have `.before-feedback` suffixes in the existing
backup directory. The source change passed all 38 repository tests. GLM still
failed the unpublished repair canary, so its experimental alias remains outside
the production pipeline. Stock Qwen3.5 9B is being evaluated next.

## Rotation across hours

Slow attempts can exhaust an hour before every category is visited. The previous
claim order reset category attempt counts each hour, then prioritized oldest
publication, allowing the same failing desks to repeatedly start first. A
six-hour production audit showed two attempted hours for San Francisco versus
six for several older sections. This is uneven access to the worker, distinct
from the model-generation failures.

The claim order now uses the last hour in which each category was actually
attempted as the tie-breaker after current-hour attempts and before publication
age. Existing recorded job history supplies this value; no schema migration is
needed. Writer-hour uniqueness, source reservations, leases, expiry, scope and
publication checks remain intact. A regression test simulates an hour with
capacity for only one failing desk and verifies that the next hour gives the
untried section its turn. All 39 repository tests pass.

The rotation change was deployed under the writer lock at about 13:48 UTC as
`cali-reporter:rotation-20261007`, image
`sha256:bbe980bede84fa388b8b36fe09230f140995a4cd1623d1a6ff34c6214b275410`.
Source and container `hourly-jobs.js` both match
`8b930d405228e79fef04875e76dd53ead63eea422a8d24e12d47ab9311dc702c`.
The homepage returned HTTP 200 and the 13:50 scheduled run started normally.
Backups use `.before-rotation` suffixes in the existing backup directory.

## Mac mini fallback — code deployed, not activated

Ben selected the Mac mini as fallback only. Justin's host remains primary.
The completion client now retries transient HTTP 429/5xx, transport, timeout or
upstream-stream failures once on a separately configured fallback. It creates
a fresh response buffer and deadline and never forwards the primary API key.
The next completion tries the primary again. Authentication errors and invalid
JSON do not trigger provider switching. All returned drafts and reviews still
pass through the same length, quotation, copying, factual-review and publication
checks; failure of both providers returns the job to durable retry.

Configuration is opt-in and currently unset:

- `LOCALFLEET_ARTICLE_FALLBACK_BASE_URL`: verified private Mac inference endpoint.
- `LOCALFLEET_ARTICLE_FALLBACK_MODEL`: model that has passed an actual Mac canary.
- `LOCALFLEET_ARTICLE_FALLBACK_REVIEW_MODEL`: optional separate review model.
- `LOCALFLEET_ARTICLE_FALLBACK_API_KEY`: only the fallback endpoint's credential,
  if required. An empty value sends no Authorization header to the Mac.

All 44 tests pass, including primary-only success, failover and return to primary,
separate credentials, partial-output discard, review-model selection, excluded
errors and bounded retry when both providers fail. These are mocked transport
checks, not evidence that the Mac has performed a live failover.

Historical inventory from September 16 identified an M4 Mac mini with 16 GiB,
Ollama on port 11435 and `qwen3.5:4b` installed. Current October 7 access checks
cannot reach it: the old SSH address times out, and the current Tailscale Mac
peer is offline. The Cali hosting server's Tailscale client also reports
`NeedsLogin`. Before activation, bring the Mac online, establish a verified
private route from the actual application container, inspect current storage
and runtime, test a suitable small model through every editorial gate, configure
persistent service/wake behavior and exercise a real primary-outage failover.
Do not enable an untested model or describe the fallback as operational.

## Date context for factual review

A live review confused a March photo-caption date with the publication timeline
of an October election report. The worker now passes the RSS publication date;
generation and review also share a fixed current timestamp for that article.
Unknown/invalid publication dates remain null. The reviewer is explicitly told
not to substitute a caption or historical-event date for publication metadata.
All 46 tests pass, including timestamp normalization, consistent context between
calls and preservation of unknown dates. This fixes missing context; it does
not by itself establish reliable factual review or restored publishing.

At about 14:19 UTC the fallback client and date-context changes were deployed
under the writer lock as `cali-reporter:fallback-ready-20261007`, image
`sha256:7592bf08e493d0e351388e73addb9147a4a49be56b70e788902ab1fe67b006f9`.
The three changed files match between Git, production source and container:

- `lib/ai/reported-article.js`: `c2b96c24b4340070c079688038caa9fce920237e7ab560a591c9982784b42937`
- `lib/hourly-jobs.js`: `71e919f5cf1a912ec5aae1308f493333a6cfdfd3ef16afdca4d4c1aad5c7829a`
- `scripts/hourly-writers.js`: `61b298a3f925a7737266f01a721c077867de5ba3fd64878428806c47740ba84b`

Backups have `.before-fallback-date` suffixes in the existing backup directory.
The image layers only those files over the rotation image, preserving the
serving frontend and unrelated live work. The homepage returned HTTP 200, and
the 14:20 cron started automatically. Fallback base/model variables remain
unset; no Mac failover has occurred. Source commit
`c7a16e77d416953d72fa344f1737e12dd63de352` was pushed and remote main verified.

Unpublished backend comparisons on the same stock 9B model, source, prompt and
seed failed the copying check under both ROCm and Vulkan (1,115 and 400 matched
words respectively). This does not establish a runtime fix. The owned Vulkan
test service was stopped after the comparison. A separate 70B factual-review
test accepted a 905-word stock-27B draft after 245 seconds, exceeding the live
240-second limit. Human review still identified attribution/generalization
concerns. Neither result is evidence of a new successful publication.

## Interrupted inference streams

A live worker received an interrupted HTTP body as `TypeError: terminated` at
14:27 UTC. That error previously entered an editorial retry and used a long
source cooldown. It now triggers configured provider failover or immediate
durable retry, with the existing five-minute infrastructure cooldown. Tests
exercise a real errored response stream and verify that partial output is
discarded and an outage without fallback makes only one generation attempt.
All 48 tests pass.

Commit `1ff72b61e818bef09f18b423e825ca65e402e3bd` was pushed and deployed before
the 14:35 scheduled run as `cali-reporter:transport-ready-20261007`, image
`sha256:05532156a08a0badc79e5f956fdc4af406be85ea526a834d1e56da93e91ee016`.
Production source/container hashes match Git: reported-article.js
`73a3bebd92687736379984566687ffae591f055d383fc0aff2112846b4d3cc20` and hourly-jobs.js
`562677da8dc4b6e44c7d7b3cd76ff8bd73650f6db41fb1a1ed39f6c02979baae`.
The prior image is the fallback-ready image; two source files and Compose were
backed up with `.before-terminated` suffixes. No model routing or fallback
activation changed.

## Dedicated writer validation before activation

Stock Qwen3.5 27B still copied heavily on a second source and its factual reviews
were inconsistent. A separate local Gemma4 26B model was downloaded and tested
on the owned loopback endpoint. The main shared Ollama service was untouched.
Gemma's model digest is
`001e5dafc3c77684c2307ebc6ab8e336e10c9b18eca52acf547d72fc83c3ca8c`.

Two unpublished tests using the real completion client passed all automated
article gates: a health article (826 final words, two drafts, 143 seconds total)
and a California report (752 final words, one draft, 77 seconds total). A control
with a deliberately false title/deck claiming an upcoming ballot measure had
already passed with 90% support was rejected. Spot-checking also found qualifier
imprecision; generation/review instructions now emphasize numerical qualifiers,
AND/OR, requests versus requirements and study subgroup counts. These tests do
not establish error-free reporting or a successful scheduled publication.

The candidate client requests strict schemas for drafts, block repairs and
reviews, disables thinking for the fast path, caps generation output at 4,000
tokens and permits six minutes per provider request. It targets shorter articles
while preserving the 600–2500-word publication boundary. When copying is limited
to at most four blocks totaling 500 words, a constrained repair replaces only
those blocks. Response indices/tags are checked, and the complete repaired
article must still pass quotation, copying and independent factual-review gates.
Larger failures keep the existing complete-draft correction loop. All 53 tests
pass, including block preservation, invalid repair rejection and mandatory
review of repaired content.

`cali-ollama.service` prepares a persistent, bounded user service on loopback
port 11437. It is not installed or enabled yet. The relay now supports explicitly
configured `CALI_RELAY_UPSTREAM` (loopback HTTP only) and
`CALI_RELAY_TIMEOUT_MS` (1–600 seconds), retaining the prior defaults. Activation
will require coordinated model/service, relay and writer configuration under
the existing publishing lock, followed by a real scheduled article and public
page check. The live primary route and model remain unchanged.

A deeper reasoning review exhausted the test service's 8,192-token context
without returning final JSON: logs showed 3,235 prompt tokens, 4,957 generated
tokens and truncation at the context boundary. A 16K-context review is being
tested before choosing the final review settings; it is not a live provider.

## Production activation and scheduled-publication verification

At approximately 15:38 UTC, the coordinated activation completed under
`/run/lock/cali-reporter-aggregate.lock`, after the previous writer exited.
Current application image: `cali-reporter:writer-candidate-20261007`,
`sha256:0a588aca1a97c97bdc1790221e44601d61cdd193171d71f61a5f6ce04669fbbe`.
Despite the staging tag name, this is now the active production image. The
reported-article.js hash matches Git, production source and container:
`a66a0e7f741f789e8f935904aa48427486b02980016756a444409c5a452c1287`.

On the inference host, `cali-ollama.service` is installed in the user's systemd
configuration, enabled and running with restart-on-failure. User lingering is
enabled. The owned transient probe service was stopped; shared Ollama and the
other vision workload remained active. The service uses one request/model,
16K context, 8 GiB memory high watermark, 12 GiB maximum and no swap. The relay
retains the existing authenticated `/cali` route and now has:

```text
CALI_RELAY_UPSTREAM=http://127.0.0.1:11437
CALI_RELAY_TIMEOUT_MS=360000
```

The relay's deployed hash is
`90484b8f77398f0bf41f4e7586492a09dd068809b00898c84a1973f426598fde`; its container
uses restart-unless-stopped. The cron explicitly sets both
`LOCALFLEET_MODEL_SECTION=gemma4:26b` and
`LOCALFLEET_MODEL_REVIEW=gemma4:26b`, retaining five-minute polling, concurrency
one, the lock, the four-minute job-claim budget and the outer 20-minute timeout.
Fast review remains selected. The optional 16K reasoning test did not finish
before the native non-streaming client's header timeout; reasoning mode was
not enabled in production.

Verification:

- All 53 code tests passed; source commit `20af4f8eb7719ed82dd3473b9afc2b0b60b1bebb`
  was pushed and remote main verified.
- A real authenticated request from the hosting container reached the dedicated
  model: headers in 0.435 seconds, complete JSON in 1.396 seconds. An
  unauthenticated request still received HTTP 401.
- Application restart policy is unless-stopped; the dedicated model unit is
  enabled/active and had zero restarts after the first two scheduled runs.
  No reboot was performed on the shared inference host.
- The 15:40 scheduled run published business post 3980 at 15:46:06 UTC, 798 words:
  [IMF report](https://calireporter.com/article/imf-chief-warns-of-economic-divergence-and-debt-risks-amid-artificial-intelligen-3374).
- The 15:50 scheduled run published good-news post 3981 at 15:55:47 UTC, 754 words:
  [Historical milestones](https://calireporter.com/article/historical-milestones-from-scientific-breakthroughs-to-civil-rights-advancements-3390).
- Both public pages returned successfully with the expected headline, canonical
  URL and AI-assistance disclosure. Post 3980's source link and NewsArticle
  publication timestamp were checked. Both article images, including the
  generated image's rendered optimization route, returned HTTP 200.
- The 16:00 poll automatically enqueued the new hour and reached a validated
  877-word San Diego draft. This verifies recurrence; it is not a claim that
  all 35 writer-hour targets are being met.

Image handling remains degraded but did not prevent publication. Post 3980 used
the existing Unsplash fallback after ComfyUI timed out. Post 3981 generated a
local AI illustration, with the text checker unavailable and the illustration
clearly identified in its caption. The scene-description request took its
120-second fallback path. No paid writing provider was enabled.

Source, Compose and cron backups use `.before-dedicated-writer` suffixes in
`/opt/cali-autoblog-backup-20261007`. The AI host's previous relay script is
`/home/ben/ai/cali-writer-stage-20261007/inference-heartbeat-proxy.mjs.before-dedicated-writer`.
For rollback, acquire the writer lock, restore only the saved writer cron and
reported-article file, select the previous transport-ready image, and restore
the relay to the shared loopback endpoint on 11434. Preserve later unrelated
cron/Compose changes and all newer articles. Disable only the new dedicated
unit if it is no longer needed; never stop the shared inference or vision jobs.

## Remaining Mac fallback activation dependency

LAN discovery found `Benjamins-Mac-mini.local` at `192.168.110.4`. SSH debug
confirmed that it matches the stored ED25519 host key for the historical Mac
address. A connection reported `This system is locked`; subsequent public-key
login attempts were denied. The model port 11435 was also unavailable on the
LAN. Tailscale's offline status therefore did not mean the physical Mac was off.

Ben was asked to unlock/sign in to the Mac account once. Blocker event
`project-10-card-463-mac-login-locked-20261007` was accepted by SMTP at
15:53:35 UTC; this is provider acceptance, not proof of inbox delivery. Once
access works, inspect the current model/runtime, establish the private hosting
connection, configure persistent operation and verify a real failover through
all article gates. No Mac configuration or model installation was performed.
Fallback endpoint/model variables remain unset.
