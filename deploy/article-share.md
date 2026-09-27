# Article sharing row

ArticleShare.jsx provides Facebook, Instagram, X and Reddit controls without external SDKs or icon dependencies. Facebook, X and Reddit links use the canonical article URL and open a new tab; X/Reddit also receive the title. Instagram invokes native Web Share when available (the device chooses available destinations), otherwise copies the URL. Permission failures expose a selectable link; cancelling native sharing does nothing. This is link sharing, not automatic Instagram publishing or Story creation.

The live newsroom has pre-existing template/byline changes absent from main. Preserve those files. Copy components/ArticleShare.jsx and apply deploy/article-share-integration.patch with git apply --check --unidiff-zero then git apply --unidiff-zero against the pre-change production tree. The patch integrates the share controls as children of the byline, immediately under the title/deck. Do not overwrite production with the legacy main article template.

Controls have accessible names, keyboard focus indicators, 44px minimum targets, native links, status feedback and wrapping layout. Labels appear at larger widths; compact widths retain named icons. No requests to sharing platforms occur before a click. Browser/native sharing availability determines the Instagram experience.

Build with docker compose build cali-reporter and deploy with docker compose up -d --no-deps cali-reporter. Rollback: /opt/cali-share-backup-20260927 and image cali-reporter:before-share-row-20260927. No database migration or audio installation is part of this change.

## Verification, 2026-09-27

Production Next.js build and deployment passed. Isolated headless Chromium checks on the live Los Angeles guide passed at 1440, 768, 390 and 320 CSS pixels: all four controls present, correct canonical URL/title encoding, 44px minimum targets, keyboard focus, no horizontal page overflow, no JavaScript page errors, and no share-platform requests before activation. Native-share success/cancellation and permission-denied/manual-copy behavior were verified with browser API stubs, without sending any social posts. Desktop and 320px screenshots were visually reviewed. Facebook/X/Reddit composer URLs were verified; account login and final posting remain actions performed by the visitor. Instagram availability in the device share menu depends on the device and installed apps.

Example: https://calireporter.com/article/los-angeles-myla311-city-service-guide
