# CaliReporter handoff — 2026-09-27

Date: September 27, 2026 (Asia/Bangkok). This is a dated snapshot, not a claim that pending automation is running.

## Project and source of truth

- Website: https://calireporter.com
- Repository: https://github.com/bensblueprints/cali-reporter — branch `main`.
- Repository baseline reviewed for this handoff: `e962b9c3247bd20cebc83eea149f89ccb562d902`.
- Boardly: board 10, **Web Hosting Clients & Infrastructure**, card 463. Its historical image/cache title now covers several CaliReporter workstreams; read current comments and checklists before changing status.
- Production: SSH alias `coolify`, source `/opt/cali-reporter`, Docker container/image `cali-reporter`. Production has changes beyond the historical repository baseline. Preserve live source, database and uploads; follow the relevant `deploy/` notes rather than replacing the whole tree blindly.
- Current documentation worktree: `/home/ben/cali-distribution-work/repository`.

## Completed and recorded verification

- Responsive WebP image optimization and database image migration completed. Cloudflare cache activation remains a separate dependency.
- Automatic NewsArticle metadata and complete archive/news sitemap discovery implemented; recorded database and live-markup checks passed (`1f77e7a`).
- Seven sections populated: Los Angeles, San Diego, San Jose, San Francisco, Fresno, Health/Nutrition, and Love/Relationships. Source-linked launch explainers, section writers and balanced publishing changes shipped (`44971c5`).
- Lightweight Facebook, Instagram, X and Reddit sharing is live beside article bylines (`77818c4`). Instagram uses native share/copy fallback. Production build and headless mobile/desktop checks passed; no social SDK is loaded for the share row. Audio was discussed but not installed.
- Five city profiles now use explicitly disclosed AI writer names: Maya Chen (LA), Lucas Bennett (SD), Nina Patel (SJ), Avery Brooks (SF), Elena Cruz (Fresno). Existing profile IDs/slugs and article ownership were preserved. Boardly records six tests, a production build, and fifteen verified public pages (`e962b9c`). See `deploy/city-writers.md`.

These are prior recorded verification results; this documentation-only task did not rerun production deployment or browser tests.

## Facebook distribution: latest requested behavior

After publication, derive each article's topic and location, discover relevant Facebook groups, and maintain editable post text in a spreadsheet. The requested account roles are one account distributing to up to three eligible groups and another discovering additional relevant local groups. Captions should invite factual discussion and visibly identify CaliReporter.

Only the planning deliverable is complete. No new publication-triggered discovery worker, group-joining agent or posting integration was enabled in this work.

### Delivered files

- [Planning workbook](../../deliverables/CaliReporter-Facebook-Planning.xlsx)
- [Draft posts CSV](../../deliverables/CaliReporter-Facebook-Drafts.csv)
- [Usage and regeneration instructions](../../deliverables/README.md)
- [Workbook generator](../../scripts/build-distribution-sheet.py)

Commit: `b94e9cbc4ac19ee4f0bf96f4bd9f4eac724fba67`. Workbook also saved as Boardly project file **971**, linked to card 463, in Boardly's cloud storage on Hetzner.

The workbook contains seven editable attributed drafts, 21 topic/location search links, two unverified group candidates, account setup fields, and an empty posting log. Search links are not verified search results. Generator checks confirmed row counts, draft statuses and publisher attribution. Regenerating overwrites edits: preserve edited copies first.

Candidate leads came from https://www.ncsa.la/about and https://jtown.org/tanoshii . Neither group's current rules, membership eligibility nor suitability for a particular article has been verified. Do not treat them as approved destinations.

### Remaining dependencies and next implementation steps

1. Identify the two intended AdsPower profiles and confirm actual owner/publisher affiliation. Do not impersonate independent local residents or create staged engagement.
2. Discover groups using topic and place; verify current rules, membership eligibility, article relevance and permission for publisher links. Ben need not supply new-group URLs: discovery is part of the requested workflow.
3. Use an authorized isolated or remote browser session. Do not automate Ben's physical Linux desktop.
4. Implement publication events, durable queued jobs, spreadsheet draft handling, review state and per-group eligibility checks. Track article/group deduplication across both accounts, submission results, failures and actual resulting post URLs.
5. Verify behavior before enabling it. Do not claim an unattended worker exists until configured and verified.

A read-only audit found an older `/home/ben/fb-poster` implementation documenting 18 personas and simulated browsing/likes. Its service reported active during that audit; that is not proof of successful posting. It was not modified or used by this work. Do not extend deceptive persona or staged-engagement behavior. Inspect current state before any authorized replacement work; preserve credentials and avoid logging them.

The account/group dependency was recorded in Boardly and its existing blocker email was accepted by SMTP, not confirmed delivered to the inbox. Avoid sending duplicate notifications for the same unresolved dependency.

## Other open or concurrent work

- Cloudflare proxy/cache permissions remain unresolved. Do not mark cache HIT verified without the necessary access and actual response evidence.
- Boardly currently includes active checklist item 1296 for five local RSS feeds and current city-topic intake, strict rewrite/review, attribution and temporary-source cleanup. This handoff does not certify that concurrent work complete. Re-read the card and latest GitHub commits before continuing.
- Boardly records a proposed always-on newsroom hierarchy and on-demand visual review using a connected DeepSeek API. That planning record explicitly did not deploy services. Verify endpoint/model image-input capability before relying on vision; uncertain reviews remain pending.
- No article audio player was implemented.

## Safe continuation and operations

- Never take over, capture or automate the physical desktop on Ben's `pop-os` workstation; no cua-driver, alternate desktop-control tool, display reset or bypass. Use terminal, SSH, APIs or isolated headless browsers.
- Check Boardly first, reuse this card, preserve concurrent work, and keep individual checklist statuses accurate. Shared card status may reflect another actively running workstream.
- Current cloud Boardly is authoritative. Its preserved local database is not writable working data. Use Boardly MCP, not direct database edits.
- Commit/push intended verified changes to the configured repository and verify the remote SHA. Never force-push or commit secrets, account credentials, TOTP seeds or private browser sessions.
- Fetch before pushing: other CaliReporter work is happening concurrently. This handoff required a fast-forward to include the named-writer change.
- Share-row rollback was recorded at `/opt/cali-share-backup-20260927` with image `cali-reporter:before-share-row-20260927`; city-profile rollback at `/opt/cali-city-authors-backup-20260927` with image `cali-reporter:before-city-authors-20260927`. Confirm availability and compatibility before using any rollback.
