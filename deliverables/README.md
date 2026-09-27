# CaliReporter Facebook planning

Open `CaliReporter-Facebook-Planning.xlsx` and edit the headline and post-text columns on Article Drafts. The CSV contains the same seven starter drafts. Group Searches contains 21 topic/location queries, not verified groups. Group Candidates contains two public-source leads whose current rules and membership eligibility still need checking.

This deliverable does not enable an agent, account access, scheduled discovery, group joining or posting. Account Setup needs the two AdsPower profile identities and confirmed publisher affiliation. Posts must accurately identify CaliReporter, fit each group's rules, and avoid duplicate article/group submissions across accounts.

Regenerate the starter files with Python and `openpyxl` installed:

```sh
python scripts/build-distribution-sheet.py
```

Regeneration overwrites both files, including manual edits. Save your edited workbook separately first. The generator checks sheet row counts, draft statuses and publisher attribution. Posting Log is intentionally empty.
