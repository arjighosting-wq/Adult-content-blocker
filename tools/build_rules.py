#!/usr/bin/env python3
"""Build CleanShield's packaged Chrome DNR rulesets from a hosts-format list.

Usage:
  python tools/build_rules.py --source ~/Downloads/porn-nl.txt --output-dir .

The generated strict/balanced JSON files are Chrome declarativeNetRequest rule
arrays, not plain arrays of domains. Keep the source attribution in
BLOCKLIST-SOURCE.md when refreshing them.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DOMAINS_PER_RULE = 500
SUBRESOURCE_TYPES = [
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "media",
    "other",
]
BALANCED_DOMAINS = [
    "adultempire.com", "avgle.com", "beeg.com", "beeg.porn", "bongacams.com",
    "brazzers.com", "cam4.com", "chaturbate.com", "e-hentai.org", "empflix.com",
    "erome.com", "evilangel.com", "exhentai.org", "extremetube.com", "fuq.com",
    "hanime.tv", "hardsextube.com", "hclips.com", "hentai-foundry.com", "hentaihaven.xxx",
    "jable.tv", "javhd.com", "javhub.net", "javmost.com", "literotica.com",
    "livejasmin.com", "motherless.com", "myfreecams.com", "naughtyamerica.com", "nhentai.net",
    "nuvid.com", "porn.com", "porndig.com", "pornhd.com", "pornhub.com",
    "pornmd.com", "pornone.com", "pornpics.com", "pornrabbit.com", "porntrex.com",
    "porntube.com", "realitykings.com", "redtube.com", "redtube.net", "rule34.xxx",
    "sexvid.xxx", "spankbang.com", "stripchat.com", "tnaflix.com", "tube8.com",
    "tubegalore.com", "xhamster.com", "xhamster.desi", "xhamsterlive.com", "xnxx.com",
    "xnxx.tv", "xvideos.com", "xvideos.red", "youjizz.com", "youporn.com",
]

# ASCII hostname-style characters, allowing underscores found in some legacy
# subdomains in the upstream list. Chrome's DNR domain matcher matches these as
# host labels when they occur in request URLs.
DOMAIN_RE = re.compile(r"^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$", re.ASCII)


def read_hosts_file(path: Path) -> tuple[list[str], str | None]:
    domains: list[str] = []
    seen: set[str] = set()
    malformed: list[tuple[int, str]] = []
    source_entries = None
    source_modified = None

    with path.open("r", encoding="utf-8-sig", errors="strict") as f:
        for line_no, line in enumerate(f, 1):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                m = re.match(r"#\s*Entries:\s*([\d,]+)", stripped, re.I)
                if m:
                    source_entries = int(m.group(1).replace(",", ""))
                m = re.match(r"#\s*Last modified:\s*(.+)", stripped, re.I)
                if m:
                    source_modified = m.group(1).strip()
                continue

            parts = stripped.split()
            if len(parts) != 2 or parts[0] not in {"0.0.0.0", "127.0.0.1"}:
                malformed.append((line_no, stripped[:100]))
                continue
            host = parts[1].strip().lower().rstrip(".")
            if (
                not host
                or not host.isascii()
                or len(host) > 253
                or not DOMAIN_RE.fullmatch(host)
                or any(not label or len(label) > 63 for label in host.split("."))
            ):
                malformed.append((line_no, host[:100]))
                continue
            if host not in seen:
                seen.add(host)
                domains.append(host)

    if malformed:
        sample = "; ".join(f"line {n}: {value}" for n, value in malformed[:5])
        raise ValueError(f"Found {len(malformed)} malformed rows; examples: {sample}")
    domains.sort()
    if source_entries is not None and source_entries != len(domains):
        raise ValueError(
            f"Source header declares {source_entries} entries, but parsed {len(domains)} unique domains. "
            "Review the source before generating production rules."
        )
    return domains, source_modified


def make_dnr_rules(domains: list[str]) -> list[dict]:
    """Make two rules per batch: redirect main-frame requests and block subresources."""
    rules: list[dict] = []
    rule_id = 1
    for offset in range(0, len(domains), DOMAINS_PER_RULE):
        batch = domains[offset : offset + DOMAINS_PER_RULE]
        rules.append(
            {
                "id": rule_id,
                "priority": 100,
                "action": {"type": "redirect", "redirect": {"extensionPath": "/blocked.html"}},
                "condition": {"requestDomains": batch, "resourceTypes": ["main_frame"]},
            }
        )
        rule_id += 1
        rules.append(
            {
                "id": rule_id,
                "priority": 100,
                "action": {"type": "block"},
                "condition": {"requestDomains": batch, "resourceTypes": SUBRESOURCE_TYPES},
            }
        )
        rule_id += 1
    return rules


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=True, separators=(",", ":"))
        f.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Hosts-format source file, e.g. porn-nl.txt")
    parser.add_argument("--output-dir", default=Path("."), type=Path, help="CleanShield project root")
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"source file not found: {args.source}")

    try:
        strict_domains, source_modified = read_hosts_file(args.source)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    source_set = set(strict_domains)
    balanced_domains = sorted(set(BALANCED_DOMAINS))
    missing_balanced = sorted(set(balanced_domains) - source_set)
    if missing_balanced:
        print(
            "ERROR: manually curated balanced domains missing from source: " + ", ".join(missing_balanced),
            file=sys.stderr,
        )
        return 2

    strict_rules = make_dnr_rules(strict_domains)
    balanced_rules = make_dnr_rules(balanced_domains)
    output = args.output_dir.resolve()
    rules_dir = output / "rules"
    write_json(rules_dir / "strict.json", strict_rules)
    write_json(rules_dir / "balanced.json", balanced_rules)
    # The old file contained synthetic test domains and is not referenced by the
    # updated manifest. Clear it so those test domains do not linger in the repo.
    write_json(rules_dir / "blocklist.json", [])
    write_json(
        rules_dir / "metadata.json",
        {
            "source": "The Block List Project — Porn Block List",
            "sourceUrl": "https://blocklistproject.github.io/Lists/alt-version/porn-nl.txt",
            "upstreamHomepage": "https://github.com/blocklistproject/Lists",
            "upstreamLicense": "MIT (as identified in source-file header)",
            "sourceLastModified": source_modified,
            "strictDomainCount": len(strict_domains),
            "strictRuleCount": len(strict_rules),
            "balancedDomainCount": len(balanced_domains),
            "balancedRuleCount": len(balanced_rules),
            "domainsPerCondition": DOMAINS_PER_RULE,
            "rulesPerBatch": 2,
            "notes": "requestDomains includes matching subdomains; see BLOCKLIST-SOURCE.md",
        },
    )

    print(f"Strict:   {len(strict_domains):,} domains -> {len(strict_rules):,} static rules")
    print(f"Balanced: {len(balanced_domains):,} domains -> {len(balanced_rules):,} static rules")
    print(f"Output:   {rules_dir}")
    print("Validation: unique domains, ASCII hostname-style entries, and balanced-list membership checked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
