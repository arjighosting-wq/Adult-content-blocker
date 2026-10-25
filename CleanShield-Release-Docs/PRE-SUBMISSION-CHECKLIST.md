# CleanShield — Chrome Web Store pre-submission checklist

**Status:** Draft checklist. Do not treat this as proof of approval or a completed release.
**Intended candidate:** CleanShield 1.1.0 (confirm the version in the current `manifest.json` before submitting).

## A. Publisher account

- [ ] A parent/legal guardian who is eligible to enter the agreement is the actual Chrome Web Store account holder and publisher, if the developer is under the legal age to contract.
- [ ] The account holder reviews and accepts the current Developer Agreement and Program Policies.
- [ ] The account holder's contact email is current and monitored.

## B. Produce the package from the latest project

- [ ] Start from the latest, pushed project folder—not an old ZIP or a patch ZIP.
- [ ] Confirm the version in `manifest.json` is the version intended for the first Web Store submission.
- [ ] Confirm `manifest.json` is at the root of the ZIP, not nested inside the project folder.
- [ ] Confirm every file referenced by the manifest exists in the package, including `icons/icon48.png` and `icons/icon128.png`.
- [ ] Confirm `declarative_net_request.rule_resources` references the packaged Strict and Balanced rule files, and each path exists.
- [ ] Include the required `rules/metadata.json`, `rules/allowlist.json`, `lib/filtering.js`, `background.js`, `blocked.html`, `blocked.js`, `options.html`, `options.js`, and CSS/assets referenced by the code.
- [ ] Include blocklist attribution and license/source notes in the repository and package where appropriate.
- [ ] Exclude `.git/`, credentials, API keys, private notes, local environment files, unrelated files, and the temporary testing rule.
- [ ] Re-extract the exact ZIP into a fresh folder and test that folder as an unpacked extension in Chrome.
- [ ] Run `python tools/validate_rules.py` from the project root, if the tool is present, and save the output.
- [ ] Confirm the actual ZIP's manifest JSON parses; Chrome's preparation guide says to put `manifest.json` at the ZIP root.

## C. Must-pass release tests

- [ ] CleanShield loads in `chrome://extensions` without errors.
- [ ] Options page opens and reports no rule-installation warning.
- [ ] Balanced mode blocks the expected test domain and redirects to `blocked.html`.
- [ ] Strict mode selects `adult_strict` and matches the expected domain.
- [ ] Custom mode disables both packaged adult blocklists but leaves SafeSearch rules active.
- [ ] Google SafeSearch URL has `safe=active` after a search.
- [ ] Bing SafeSearch URL has `adlt=strict` after a search.
- [ ] DuckDuckGo URL has `kp=1` after a search.
- [ ] Yandex URL has the intended family-filter parameter after a search; record the final URL actually observed.
- [ ] Blocked page displays the correct hostname for a temporary harmless test redirect.
- [ ] Temporary test rule ID `999999` is absent from dynamic rules after testing.
- [ ] Disabling CleanShield disables its adult rules and SafeSearch rules.
- [ ] Allowlist exception works only for the intended domain and respects locked mode.
- [ ] Set password, lock, unlock, invalid password, and locked-settings restrictions tested.
- [ ] Test a non-blocked ordinary site to detect false positives.
- [ ] Test at least one blocked main-frame navigation and a blocked subresource behavior where practical.
- [ ] Re-test after reloading Chrome and after reinstalling the exact release ZIP.

## D. Store listing

- [ ] Clear title and concise description that accurately describe the extension's capabilities and limitations.
- [ ] Store icon is 128×128 px.
- [ ] At least one clear, accurate screenshot is included; Google lists screenshots at 1280×800 px (up to five).
- [ ] Screenshots show the actual UI. Avoid explicit imagery; use a harmless SafeSearch query such as `cats`.
- [ ] Select the most relevant category and language.
- [ ] Add a working support contact and a reasonable way to report issues.
- [ ] Do not claim all adult websites are blocked; the domain list cannot guarantee complete coverage.

## E. Privacy and permissions

- [ ] Publish a working, publicly accessible privacy-policy URL and put that URL in the designated dashboard field.
- [ ] Ensure the policy matches the current code, not an earlier implementation.
- [ ] Explicitly disclose local processing of website hostnames, even if no browsing information is sent to a server.
- [ ] Declare data handling accurately in the dashboard Privacy practices tab, including local handling of browsing activity/domains.
- [ ] Give a specific, truthful single-purpose statement.
- [ ] Justify each declared permission (`declarativeNetRequest`, `storage`, `webNavigation`, `tabs`, and `<all_urls>` host access) and remove any permission the current code does not need.
- [ ] Ensure privacy policy and dashboard disclosures do not contradict the code or listing.

## F. Release record

- [ ] Save the exact uploaded ZIP, its SHA-256 hash, manifest version, source list date, validation output, test report, listing text, and submission date.
- [ ] Record Google's submission ID/status and any review feedback.
- [ ] If rejected, preserve the exact message, change only what is needed, increment the version if code/package changes, re-test, and document the next attempt.

## Known pre-submission caution

The earlier project ZIP shared for inspection was an older snapshot (manifest version 1.0.0) and did not contain all files referenced by its manifest, including the icon files, or the static ruleset declaration used by the later blocklist patch. Do **not** upload that old ZIP. Build the release ZIP from the current, complete project folder and inspect the archive before submission.
