# CaliReporter publishing recovery — October 7, 2026

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

No paid writing fallback has been enabled. Approval was requested for an
optional DeepSeek fallback with an estimated $2/day usage cap; it is not part of
this deployment. No unrelated model jobs were stopped or Ollama settings changed.

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

Publication recovery remains unverified until a fresh scheduled job passes
generation, review, image handling and database insertion and its public page
is checked. The shared model's queue and repeated rejected drafts remain the
throughput constraint. Inspect the timestamped writer log and run
`node scripts/audit-hourly-coverage.js --since=2026-10-07T11:50:00Z` to measure
actual post-deployment output.

The unresolved dependency is usable inference capacity. The next action is to
allocate a dedicated local writing endpoint/model without displacing other
workloads, or approve and implement the separately proposed capped paid fallback,
then repeat a complete scheduled-publication verification. No paid provider is
called by this repair. The scheduler remains enabled while the dependency is
unresolved, with the new bounded retries and cooldowns.

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
