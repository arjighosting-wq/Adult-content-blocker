# CleanShield blocklist refresh patch

This patch replaces CleanShield's synthetic test domains / legacy single-source
snapshot with two attributed sources, each kept under its own licence notice.

## Contents

- `rules/strict.json`, `rules/balanced.json`, `rules/metadata.json`
- `blocklists/sources/` — the original input snapshots used for this generated data
- `BLOCKLIST-SOURCE.md` — generation method, counts, hashes, refresh guidance
- `THIRD-PARTY-NOTICES.md`
- `LICENSES/` — separate MIT and Unlicense texts
- `tools/build_rules.py` and `tools/validate_rules.py`

## Apply to CleanShield

Copy/merge the contents of this patch into the root of your existing CleanShield project.
Replace matching files in `rules/`, `BLOCKLIST-SOURCE.md`, and `tools/`; add the new
folders/files. Keep your existing `rules/allowlist.json`.

Do not replace `manifest.json`, `background.js`, `options.html`, or any other application
code with this data-only patch.

Then, from the project root, run:

```bash
python tools/validate_rules.py
```

Expected validator summary:

- Strict: 1,028 rules and 256,545 compressed request-domain patterns.
- Balanced: 88 rules and 21,814 compressed request-domain patterns.

The compressed pattern sets preserve the original suffix-matching coverage. Chrome's
`requestDomains` condition matches the listed domain and its subdomains.

Also load the unpacked extension in Chrome and test Strict, Balanced, Custom, SafeSearch,
allowlist, password lock, and the blocked page before releasing. The two source snapshots
are for reproducibility and attribution in the public source repository; do not include
them in the Chrome Web Store upload ZIP unless needed at runtime (they are not needed
at runtime).

Both upstream lists may contain stale entries or false positives. Balanced is the
intersection of the lists' matching coverage, not a guarantee of zero false positives.
Keep the false-positive reporting path and update process.
