# CleanShield — Candidate release test report

**Date recorded:** 2026-10-25  
**Candidate:** 1.1.0 (verify the version in the final package)  
**Testing method:** Manual checks performed by the developer in Chrome and service-worker DevTools. This is not a full automated test suite or proof of complete adult-site coverage.

## Checks reported as passing

| Area | Test | Result recorded |
|---|---|---|
| Service worker | Reload extension and inspect errors | Started without error after replacing the invalid navigation event listener |
| Settings | Options page rule warning | No warning observed |
| Google SafeSearch | Search URL parameter | `safe=active` observed |
| Bing SafeSearch | Search URL parameter | `adlt=strict` observed |
| DuckDuckGo SafeSearch | Search URL parameter | `kp=1` observed |
| Yandex SafeSearch | Search URL parameter | `family=1` observed after the Yandex regex fix |
| Balanced mode | `testMatchOutcome` on `https://www.xvideos.com/` | Matched `adult_balanced`, rule ID 1 |
| Strict mode | `testMatchOutcome` on `https://www.xvideos.com/` | Matched `adult_strict`, rule ID 3633 |
| Custom mode | `testMatchOutcome` on `https://www.xvideos.com/` | Returned zero matched rules |
| Custom mode SafeSearch | `testMatchOutcome` for a Google search URL | Matched dynamic rule ID 60000 |
| Block page hostname | Temporary harmless redirect rule for `example.com` | Blocked page displayed `example.com` |
| Cleanup (first check) | Rule ID 999999 | Previously confirmed absent, but the rule was subsequently added again for the hostname display test |

## Release blocker to resolve

After the later hostname display test, the temporary rule with ID `999999` was added again. The developer was instructed to remove it, but removal has not yet been confirmed. Before producing the final release ZIP, run this in the CleanShield service-worker console:

```js
await chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [999999]
});
```

Then verify:

```js
(await chrome.declarativeNetRequest.getDynamicRules())
  .some(rule => rule.id === 999999)
```

The result must be `false`.

## Not yet established by these tests

- The blocklist blocks every adult site; no blocklist can guarantee that.
- The list has no false positives.
- Allowlist behavior in all cases, lock edge cases, disabled-state behavior, subresource blocking, and update/reinstall behavior are fully correct.
- Google has approved the extension.

Before submission, test those paths on the exact release ZIP and write down the actual results. If a test is not run, mark it “Not tested” rather than “Passed.”
