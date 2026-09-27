# Named city writers

City bylines now use distinct AI writer names: Los Angeles/Maya Chen, San Diego/Lucas Bennett, San Jose/Nina Patel, San Francisco/Avery Brooks, Fresno/Elena Cruz. Bylines identify the city; profile biographies disclose that these are editorial identities, not human reporters. Existing organization author schema remains accurate for these editorial identities.

Author IDs and existing /authors/{city}-desk URLs stay unchanged, so all already-linked articles pick up the names and old links remain valid. Updated section seeding preserves the names on subsequent importer runs. Health and relationships profiles are unchanged.

Preview: `node scripts/name-city-writers.js`. Apply: `node scripts/name-city-writers.js --apply`. Set DATABASE_PATH when outside the application directory. Apply first creates an online SQLite backup under data/author-backups; updates only the five existing city author profiles, without changing articles or publication dates.

Validation: `node --test tests/section-coverage.test.mjs`. Verify each city page, profile and a linked article after deployment. Production source/image rollback saved under /opt/cali-city-authors-backup-20260927 and cali-reporter:before-city-authors-20260927. Restore the five author fields from the database backup for a targeted rollback; do not replace a live database after new articles have arrived.
