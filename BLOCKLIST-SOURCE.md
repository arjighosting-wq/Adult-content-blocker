# CleanShield blocklist source and maintenance

## Upstream data

- **Project:** The Block List Project — Lists
- **List:** Porn Block List (`porn-nl.txt`, hosts format)
- **Source URL:** https://blocklistproject.github.io/Lists/alt-version/porn-nl.txt
- **Project homepage:** https://github.com/blocklistproject/Lists
- **License reported in the upstream file header:** MIT
- **Snapshot's upstream modification timestamp:** 2026-07-18 01:36:50 UTC
- **Input entry count:** 953,393 unique ASCII hostnames

The source list is third-party data. Its categories can change and can include stale entries or false positives. A blocklist is not a guarantee that every adult website is detected.

## How the rules are packaged

`rules/strict.json` and `rules/balanced.json` are **Chrome declarativeNetRequest static rule arrays**, not plain arrays of domain strings. The source domains are grouped into batches of 500 in `requestDomains` conditions. Each batch has a main-frame redirect rule to `blocked.html` and a subresource blocking rule. Chrome's `requestDomains` matching also applies to subdomains.

- Strict mode: 953,393 domains, 3,814 static rules.
- Balanced mode: 60 manually curated domains confirmed to exist in the supplied snapshot, 2 static rules. It is intentionally smaller and less comprehensive.
- Custom mode: disables both adult-domain static rulesets; SafeSearch can remain enabled.
- User allowlist rules are dynamic and use priority 200 so they override adult block rules at priority 100.
- SafeSearch redirects remain dynamic at priority 50.

This design avoids creating two dynamic rules for every domain and avoids reading the large source list into the service worker at startup.

## Refreshing the data

1. Download a fresh hosts-format list from the source URL above.
2. Run from the CleanShield project root:

   ```bash
   python tools/build_rules.py --source "path/to/porn-nl.txt" --output-dir .
   ```

3. Review the source timestamp and generated rule counts in `rules/metadata.json`.
4. Load the extension unpacked in Chrome and test strict, balanced, custom, SafeSearch, allowlist, password lock, and the blocked page before releasing an update.

The generator checks the source header count, uniqueness, ASCII/domain-like format, and that the curated balanced domains exist in the source. Keep this file and the source attribution when redistributing the extension.
