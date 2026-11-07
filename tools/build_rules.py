#!/usr/bin/env python3
"""Build CleanShield's Strict/Balance DNR rules from two attributed sources.

Run from the project root:
    python tools/build_rules.py

Inputs:
    blocklists/sources/shadowwhisperer-adult.txt
    blocklists/sources/sinfonietta-pornography-hosts.txt

Strict is the source union. Balanced is the intersection of each source's
suffix-based requestDomains coverage. Invalid and non-domain entries are
excluded and summarized in rules/metadata.json.
"""
from __future__ import annotations

import collections
import hashlib
import ipaddress
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHADOW_SOURCE = ROOT / "blocklists" / "sources" / "shadowwhisperer-adult.txt"
SINFONIETTA_SOURCE = ROOT / "blocklists" / "sources" / "sinfonietta-pornography-hosts.txt"
RULES = ROOT / "rules"
DOMAINS_PER_RULE = 500
SUBRESOURCE_TYPES = [
    "sub_frame", "stylesheet", "script", "image", "font", "object",
    "xmlhttprequest", "ping", "media", "other",
]
RESERVED_SUFFIXES = (".localhost", ".local", ".invalid", ".test", ".example")
RESERVED_NAMES = {"localhost", "local", "invalid", "test", "example",
                  "example.com", "example.net", "example.org"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_domain(value: str) -> tuple[str | None, str | None]:
    host = value.strip().lower().rstrip(".")
    if host.startswith("*."):
        host = host[2:]
    if host.startswith("."):
        host = host[1:]
    if not host or len(host) > 253:
        return None, "empty_or_length"
    try:
        ipaddress.ip_address(host)
        return None, "ip_address"
    except ValueError:
        pass
    try:
        host = host.encode("idna").decode("ascii").lower()
    except UnicodeError:
        return None, "idna"
    if len(host) > 253 or "." not in host:
        return None, "not_fqdn"
    if host in RESERVED_NAMES or host.endswith(RESERVED_SUFFIXES):
        return None, "reserved_test_name"
    for label in host.split("."):
        if not label or len(label) > 63:
            return None, "label_length"
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", label):
            return None, "invalid_label"
    return host, None


def read_plain_domain_file(path: Path) -> tuple[set[str], dict]:
    domains: set[str] = set()
    bad = collections.Counter()
    rows = 0
    with path.open("r", encoding="utf-8-sig", errors="strict") as source:
        for line_no, line in enumerate(source, 1):
            stripped = line.split("#", 1)[0].strip()
            if not stripped:
                continue
            rows += 1
            parts = stripped.split()
            if len(parts) != 1:
                raise ValueError(f"{path.name}:{line_no}: expected one domain per row")
            domain, reason = normalize_domain(parts[0])
            if reason:
                bad[reason] += 1
            else:
                domains.add(domain)
    return domains, {"dataRows": rows, "validUniqueDomains": len(domains),
                     "excluded": dict(sorted(bad.items()))}


def read_hosts_file(path: Path) -> tuple[set[str], dict]:
    domains: set[str] = set()
    bad = collections.Counter()
    duplicates = 0
    host_tokens = 0
    with path.open("r", encoding="utf-8-sig", errors="strict") as source:
        for line_no, line in enumerate(source, 1):
            stripped = line.split("#", 1)[0].strip()
            if not stripped:
                continue
            parts = stripped.split()
            if len(parts) < 2:
                raise ValueError(f"{path.name}:{line_no}: expected IP plus one or more hostnames")
            try:
                ipaddress.ip_address(parts[0])
            except ValueError as exc:
                raise ValueError(f"{path.name}:{line_no}: invalid hosts-file address") from exc
            for token in parts[1:]:
                host_tokens += 1
                domain, reason = normalize_domain(token)
                if reason:
                    bad[reason] += 1
                    continue
                if domain in domains:
                    duplicates += 1
                domains.add(domain)
    return domains, {"hostTokens": host_tokens, "validUniqueDomains": len(domains),
                     "duplicatesRemoved": duplicates,
                     "excluded": dict(sorted(bad.items()))}


def covered_by(domain: str, patterns: set[str]) -> bool:
    labels = domain.split(".")
    for index in range(len(labels)):
        if ".".join(labels[index:]) in patterns:
            return True
    return False


def minimize_patterns(domains: set[str]) -> list[str]:
    """Drop a child pattern when a parent pattern already covers its subdomains."""
    minimized = []
    for domain in sorted(domains, key=lambda item: (item.count("."), item)):
        labels = domain.split(".")
        if any(".".join(labels[index:]) in domains
               for index in range(1, len(labels))):
            continue
        minimized.append(domain)
    return minimized


def make_rules(domains: list[str]) -> list[dict]:
    rules = []
    rule_id = 1
    for offset in range(0, len(domains), DOMAINS_PER_RULE):
        batch = domains[offset:offset + DOMAINS_PER_RULE]
        rules.append({
            "id": rule_id,
            "priority": 100,
            "action": {"type": "redirect",
                       "redirect": {"extensionPath": "/blocked.html"}},
            "condition": {"requestDomains": batch,
                          "resourceTypes": ["main_frame"]},
        })
        rule_id += 1
        rules.append({
            "id": rule_id,
            "priority": 100,
            "action": {"type": "block"},
            "condition": {"requestDomains": batch,
                          "resourceTypes": SUBRESOURCE_TYPES},
        })
        rule_id += 1
    return rules


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as target:
        json.dump(obj, target, ensure_ascii=True, separators=(",", ":"))
        target.write("\n")


def main() -> int:
    for path in (SHADOW_SOURCE, SINFONIETTA_SOURCE):
        if not path.is_file():
            raise SystemExit(f"Missing source snapshot: {path.relative_to(ROOT)}")

    shadow, shadow_stats = read_plain_domain_file(SHADOW_SOURCE)
    sinfonietta, sinfonietta_stats = read_hosts_file(SINFONIETTA_SOURCE)

    strict_union = shadow | sinfonietta
    # Include the narrower domain pattern when it is covered by a parent
    # pattern in the other source. This calculates overlapping suffix coverage.
    balanced_intersection = (
        {domain for domain in shadow if covered_by(domain, sinfonietta)}
        | {domain for domain in sinfonietta if covered_by(domain, shadow)}
    )
    # requestDomains matches a domain and its subdomains. Remove descendant
    # patterns already covered by a parent to reduce rule-file size without
    # changing the set of hosts matched.
    strict = minimize_patterns(strict_union)
    balanced = minimize_patterns(balanced_intersection)

    strict_rules = make_rules(strict)
    balanced_rules = make_rules(balanced)
    write_json(RULES / "strict.json", strict_rules)
    write_json(RULES / "balanced.json", balanced_rules)

    metadata = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).date().isoformat(),
        "strictDomainCount": len(strict),
        "strictRuleCount": len(strict_rules),
        "balancedDomainCount": len(balanced),
        "balancedRuleCount": len(balanced_rules),
        "domainsPerCondition": DOMAINS_PER_RULE,
        "rulesPerBatch": 2,
        "sourceFiles": [
            {
                "name": SHADOW_SOURCE.name,
                "source": "ShadowWhisperer / BlockLists / Lists / Adult",
                "sourceUrl": "https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/master/Lists/Adult",
                "repositoryLicense": "Unlicense",
                "sha256": sha256_file(SHADOW_SOURCE),
                **shadow_stats,
            },
            {
                "name": SINFONIETTA_SOURCE.name,
                "source": "Sinfonietta / hostfiles / pornography-hosts",
                "sourceUrl": "https://raw.githubusercontent.com/Sinfonietta/hostfiles/master/pornography-hosts",
                "repositoryLicense": "MIT (Copyright (c) 2016 Sinfonietta)",
                "sha256": sha256_file(SINFONIETTA_SOURCE),
                **sinfonietta_stats,
            },
        ],
        "exactDuplicateCountAcrossSources": len(shadow & sinfonietta),
        "strictUnionInputDomainCount": len(strict_union),
        "strictRedundantSubdomainPatternsRemoved": len(strict_union) - len(strict),
        "strictDomainCount": len(strict),
        "balancedOverlapCoverageInputDomainCount": len(balanced_intersection),
        "balancedRedundantSubdomainPatternsRemoved": len(balanced_intersection) - len(balanced),
        "balancedDomainCount": len(balanced),
        "balancedMethod": "Suffix-coverage intersection: retain a source domain only if the other source contains that domain or a parent domain; then remove child patterns already covered by a parent pattern.",
        "notes": "requestDomains also matches subdomains. Review for false positives and refresh source snapshots responsibly.",
    }
    write_json(RULES / "metadata.json", metadata)
    print(f"Strict:   {len(strict_union):,} union entries -> {len(strict):,} match patterns -> {len(strict_rules):,} static rules")
    print(f"Balanced: {len(balanced_intersection):,} overlap entries -> {len(balanced):,} match patterns -> {len(balanced_rules):,} static rules")
    print(f"Exact duplicate domains: {len(shadow & sinfonietta):,}")
    print("Source exclusions:", json.dumps({
        "shadow": shadow_stats.get("excluded", {}),
        "sinfonietta": sinfonietta_stats.get("excluded", {}),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
