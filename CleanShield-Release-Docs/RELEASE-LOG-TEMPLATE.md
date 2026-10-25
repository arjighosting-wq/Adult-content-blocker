# CleanShield release log

Use one entry per release. Do not mark a release as published until Google has approved it and the publisher has actually published it.

## Release candidate: 1.1.0 (draft)

- **Status:** Not yet submitted / not approved / not published (update only when true).
- **Candidate date:** 2026-10-25
- **Publisher account holder:** [Parent/guardian account, with permission]
- **Git commit:** [Paste full commit hash]
- **Release ZIP filename:** [Filename]
- **ZIP SHA-256:** [Hash]
- **Blocklist source:** The Block List Project — [URL]
- **Upstream list timestamp in packaged metadata:** 2026-07-18 01:36:50 UTC (refresh before release, then update this field)
- **Validation command/output:** [Paste exact output from tools/validate_rules.py]
- **Test report:** [Link to TEST-REPORT-CANDIDATE.md, updated with final results]
- **Privacy policy URL:** [Public URL]
- **Store listing screenshots:** [List filenames]
- **Submission date / dashboard ID:** [Fill after submit]
- **Review result/date:** [Fill only after Google reports the result]
- **Publication date / store URL:** [Fill only after published]

### Summary of intended changes

- Replace synthetic `.invalid` test data with sourced domain data.
- Package Strict and Balanced domain blocking as static Declarative Net Request rulesets.
- Preserve Custom-mode behavior and SafeSearch support.
- Correct navigation-event handling for the blocked-page hostname.
- Correct Yandex SafeSearch URL matching.

### Known limitations at candidate time

- The blocklist is not guaranteed to cover every adult site.
- False positives and false negatives are possible.
- Manual feature tests are not a comprehensive security or compatibility audit.
- The packaged upstream list should be refreshed before publication.

### Review notes

[Record actual Google feedback verbatim and link to the fix commit, if there is a rejection or requested change.]
