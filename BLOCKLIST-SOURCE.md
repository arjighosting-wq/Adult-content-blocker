# CleanShield blocklist sources and generation

## Purpose

CleanShield uses two independently maintained public adult-domain lists. It
preserves the upstream files, their separate licence notices, and the exact
SHA-256 hashes used to build the packaged rules.

## Input sources

### 1. ShadowWhisperer / BlockLists — Adult

- Repository: https://github.com/ShadowWhisperer/BlockLists
- Input file: `blocklists/sources/shadowwhisperer-adult.txt`
- Upstream raw URL: https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/master/Lists/Adult
- Repository licence: Unlicense (see `LICENSES/ShadowWhisperer-Unlicense.txt`)
- Source-file update header: 2026-11-05 22:42 CST
- Parsed valid unique domains: 236,454
- SHA-256: `4eb9d0d020d546521c4d90485d7c423f6fbb1336e880d003fd08dcce5c7675d3`

### 2. Sinfonietta / hostfiles — pornography-hosts

- Repository: https://github.com/Sinfonietta/hostfiles
- Input file: `blocklists/sources/sinfonietta-pornography-hosts.txt`
- Upstream raw URL: https://raw.githubusercontent.com/Sinfonietta/hostfiles/master/pornography-hosts
- Repository licence: MIT, copyright (c) 2016 Sinfonietta (see `LICENSES/Sinfonietta-MIT.txt`)
- The supplied file has no embedded update timestamp; it was supplied for this build on 2026-11-07.
- Parsed valid unique domains: 61,154
- Duplicate entries removed: 35
- Invalid/non-domain entries excluded: 7 (five IP addresses, one hostname with an underscore, and one single-label entry)
- SHA-256: `d5c31a7ee9f1920df47044270449ad42a1b09ad4f3b608410383abaabb27fa1d`

## Generation method

- **Strict input union:** the union of all valid unique domains in both sources: **278,190 entries**. The sources share **19,418 exact domain strings**.
- **Balanced input overlap:** the intersection of the sources' effective `requestDomains` coverage: **33,330 entries before compression**. A source entry covers itself and its subdomains. If one source lists `example.com` and the other lists `media.example.com`, Balanced retains `media.example.com` because that is the common covered scope. This is more accurate than requiring byte-for-byte identical domain strings.
- Domain names are normalized to lowercase ASCII/IDNA, trailing dots are removed, and invalid host tokens, IP addresses, single-label names, and reserved test names are excluded.
- Because Chrome `requestDomains` matches the listed domain and its subdomains, a child pattern is redundant when a parent pattern is already included. The generator removes these redundant descendant patterns without changing the matched hostname coverage.

## Chrome rule packaging

`rules/strict.json` and `rules/balanced.json` are Chrome
`declarativeNetRequest` static rule arrays, not plain domain arrays. Each batch
contains at most 500 domains in `requestDomains`:

- one rule redirects top-level (`main_frame`) requests to `/blocked.html`;
- one rule blocks the listed subresource types.

Chrome documents that `requestDomains` matches the listed domain and its
subdomains. The generated counts are:

| Mode | Source-derived entries before compression | `requestDomains` patterns | Static rules |
|---|---:|---:|---:|
| Strict | 278,190 | 256,545 | 1,114 |
| Balanced | 33,330 | 21,814 | 134 |

Redundant descendants removed: **21,645** in Strict and **11,516** in Balanced. A coverage-equivalence check verified that compressing the patterns preserves all source-derived suffix matches.

These counts are well below Chrome's documented guaranteed minimum of 30,000
static rules across enabled static rulesets. Chrome's actual available quota
can depend on other installed extensions.

## Regenerate

From the CleanShield project root, after placing both source snapshots at the
paths above, run:

```bash
python tools/build_rules.py
python tools/validate_rules.py
```

Keep the snapshots, hashes, notices, and generation metadata together. Review
the generated list and test false positives before each production release.
Do not claim that any blocklist catches every adult site.
