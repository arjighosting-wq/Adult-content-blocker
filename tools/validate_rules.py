#!/usr/bin/env python3
"""Validate CleanShield's generated static DNR rule files."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / "rules"
BATCH_LIMIT = 500
SUBRESOURCE_TYPES = {
    "sub_frame", "stylesheet", "script", "image", "font", "object",
    "xmlhttprequest", "ping", "media", "other",
}


def load(name):
    with (RULES / name).open(encoding="utf-8") as f:
        value = json.load(f)
    if not isinstance(value, list):
        raise ValueError(f"{name} must contain a JSON array")
    return value


def validate(name, expected_max=None):
    rules = load(name)
    ids = [r.get("id") for r in rules]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{name} has duplicate rule IDs")
    if any(not isinstance(i, int) or i < 1 for i in ids):
        raise ValueError(f"{name} has an invalid rule ID")
    if expected_max is not None and len(rules) > expected_max:
        raise ValueError(f"{name} exceeds expected number of rules")
    if len(rules) % 2:
        raise ValueError(f"{name} should contain redirect/block rule pairs")
    domains = 0
    for i in range(0, len(rules), 2):
        redirect, block = rules[i], rules[i + 1]
        rd = redirect.get("condition", {}).get("requestDomains")
        bd = block.get("condition", {}).get("requestDomains")
        if not isinstance(rd, list) or not rd or len(rd) > BATCH_LIMIT:
            raise ValueError(f"{name} rule {redirect.get('id')} has invalid requestDomains")
        if rd != bd:
            raise ValueError(f"{name} batch does not share the same domains across its rule pair")
        if redirect.get("action") != {"type": "redirect", "redirect": {"extensionPath": "/blocked.html"}}:
            raise ValueError(f"{name} rule {redirect.get('id')} is not a block-page redirect")
        if redirect.get("condition", {}).get("resourceTypes") != ["main_frame"]:
            raise ValueError(f"{name} rule {redirect.get('id')} must only redirect main frames")
        if block.get("action") != {"type": "block"}:
            raise ValueError(f"{name} rule {block.get('id')} must block subresources")
        if set(block.get("condition", {}).get("resourceTypes", [])) != SUBRESOURCE_TYPES:
            raise ValueError(f"{name} rule {block.get('id')} has unexpected resourceTypes")
        if any(not isinstance(d, str) or not d.isascii() or "." not in d for d in rd):
            raise ValueError(f"{name} contains a non-ASCII or invalid-looking domain entry")
        if any(d.endswith(".invalid") for d in rd):
            raise ValueError(f"{name} still contains synthetic .invalid test domains")
        domains += len(rd)
    print(f"PASS {name}: {len(rules):,} rules, {domains:,} domain entries")
    return domains


def main():
    try:
        strict_domains = validate("strict.json")
        balanced_domains = validate("balanced.json")
        with (RULES / "metadata.json").open(encoding="utf-8") as f:
            meta = json.load(f)
        if strict_domains != meta.get("strictDomainCount"):
            raise ValueError("metadata strictDomainCount does not match strict rule domains")
        if balanced_domains != meta.get("balancedDomainCount"):
            raise ValueError("metadata balancedDomainCount does not match balanced rule domains")
        if meta.get("strictRuleCount") != len(load("strict.json")):
            raise ValueError("metadata strictRuleCount does not match rules file")
        if meta.get("balancedRuleCount") != len(load("balanced.json")):
            raise ValueError("metadata balancedRuleCount does not match rules file")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("PASS metadata: counts agree with generated rule files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
