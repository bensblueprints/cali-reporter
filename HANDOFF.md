# CaliReporter handoff — October 18, 2026

## Requested outcome and present state

The goal is 24/7 source-linked, AI-assisted publishing across the existing
writers and 13 desks, followed by sharing through Facebook groups. The user
asked to replace Ollama with another runtime and then asked for this handoff to
be published to GitHub and coding to stop.

**Publishing is not activated. No article was published by this work.** The
public site still runs the pre-change `migrated-cali` container on Hetzner. Its
five-minute worker cron still uses the existing upstream inference URL, which
was failing during the October 18 audit. No new production articles were found
since October 7. The model, feed, worker and deployment changes described below
are prepared for review; they have not been deployed to the public worker.

## Runtime and access

- The Mac is reachable with `ssh mac-mini`. Native MLX is installed in
  `/Users/benji/cali-writer/.venv`; the current pinned test snapshot is
  `mlx-community/Qwen3.5-9B-4bit`, revision
  `8b2b98c00a6b4d291155e4890773ca8f769aee53`, at
  `/Users/benji/cali-writer/qwen-model`.
- LaunchDaemon `system/com.calireporter.mlx` runs the custom
  `mlx-writer-server.py` as `benji`, listening only on `127.0.0.1:11435`.
  It exposes the fixed model ID `default_model`, constrains output to the
  caller's JSON schema, allows one generation at a time, and has a watchdog
  restart. A deliberate SIGTERM test recovered within a few seconds.
- Hetzner is `ssh hetzner`; the live container is `migrated-cali`. Its private
  bridge tunnel reaches the Mac at `http://10.0.32.1:11438`. The listener is
  limited to the Docker bridge by an INPUT rule. Do not expose port 11435 or
  11438 publicly.
- Ollama was not selected for the final runtime. The old unrelated Ollama
  configuration on the Mac still points to an absent external volume; it was
  left untouched. The temporary Cali-only Ollama service was stopped and its
  test model files removed.

## Model quality: the main open issue

The earlier Gemma 4 E4B MLX draft could satisfy mechanical checks but included
unsupported details and repetitive padding; its own factual review accepted
one such draft. It is not suitable for publishing. The Qwen 3.5 9B MLX snapshot
was downloaded and installed for comparison. Its service and tunnel are
available, but a full English-source article from this model has not yet been
canaried. Controls using the latest review prompt caught fabricated
figures/status, lost funding qualifiers, unsupported comparisons and added cost
categories. One earlier control using the smaller review format missed an
unsupported comparison; the review format now requires a
claim/evidence/support check before the verdict.

The latest complete full-article canary was from the rejected E4B model, used a
CalMatters housing-bond report, and was not published. Do not treat its
automated `supported:true` as evidence of reliable review. Run Qwen 9B through
the full unpublished writer canary, inspect the final article against its full
source, and run all review controls before considering activation. Keep the
existing 600–2,500-word, source-overlap, quote, completed-paragraph and factual
checks intact. Do not pad or invent text to meet length.

## Prepared code and configuration

- `feeds.json` selects a verified primary feed for every desk, keeps working
  secondaries, excludes failed/stale feeds, and filters Spanish and newsletter
  roundup pages from CalMatters. The previous live feed configuration is saved
  at `deploy/feeds.production-20261018.json`.
- `deploy/feed-writer-map.json` maps the 13 categories and 35 existing writers
  to feeds and voice prompts. `lib/section-coverage.js` adds distinct local
  voice prompts for the five city desks while retaining customized voices.
- `lib/ai/reported-article.js` uses the assigned writer's voice, structured
  plain-text sections, safe DOM rendering, source attribution, nofollow links,
  factual checks, quote/overlap checks, and complete-paragraph validation.
- `deploy/mlx-writer-server.py`, `deploy/install-mac-mlx.py`, the model
  manifest and pinned requirements configure the private MLX service.
- `deploy/Dockerfile.mac-writer` layers worker files over the actual October 16
  production image so the newer live frontend is retained. The candidate image
  `selected-migration/cali:20261018-mac` has been built on Hetzner, but is not
  activated. Rebuild it if the worker files change.
- `deploy/replace-cali-container.py` preserves container settings and network
  identity, checks the homepage, and restores the old container if startup
  fails. `deploy/activate-mac-writer.py` backs up SQLite and config, installs
  the candidate feeds, then changes the cron endpoint. Run it only while holding
  `/run/lock/migrated-cali-aggregate.lock` and after model quality is verified.
- The activation script also replaces the existing daily backup command with
  `scripts/backup-database.mjs`, which uses SQLite's online backup API. The
  current cron backup line points to a database filename that does not exist.
- Private server snapshots, canary source/output and deployment backups are in
  `/opt/cali-recovery-20261018` on Hetzner. Do not commit those private
  artifacts or full scraped source text.

## Verification and evidence limits

- 59 Node tests passed before the latest factual-review schema/prompt edits.
  Six MLX endpoint tests passed on the Mac before changing the loaded model from
  E4B to Qwen 9B. Rerun them and the Node suite after this handoff when work
  resumes; their results do not cover the very latest code edits.
- The Qwen service health endpoint works after installation, and the launchd
  restart recovery was exercised. The Qwen full writer canary and final reviewer
  controls remain outstanding.
- The candidate Docker image was built after adding the online SQLite backup
  script. It has not been used to replace the live container.
- No public-page verification, scheduled post, or sustained 24/7 observation
  has occurred for the prepared MLX path.

## Resume sequence

1. Run Node and endpoint tests because code changed after the last passing run.
2. Run the full unpublished article canary with Qwen on a substantial English
   source. Manually compare every number, qualifier, attribution and claim with
   the source. Reject padded, repetitive, incomplete or unsupported output.
3. Repeat on more than one category and writer, then activate under the existing
   flock with the prepared backup and rollback procedure. Verify the public
   homepage, a published article's source `nofollow` link, correct byline and
   complete body, and subsequent scheduled runs before reporting the system as
   restored.
4. Facebook sharing has not started. Before that step, identify the publisher's
   authorized accounts, the specific groups, group rules, and disclose the
   publisher/AI context. No messages or posts have been sent.

The more detailed incident record is in
[`deploy/autoblogging-recovery-2026-10-07.md`](deploy/autoblogging-recovery-2026-10-07.md).
