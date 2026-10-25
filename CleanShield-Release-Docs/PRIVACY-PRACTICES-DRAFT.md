# CleanShield — Privacy practices tab preparation notes

These are draft statements for the publisher to compare against the exact code and the current dashboard questions. Do not blindly select boxes; answer each live question accurately.

## Single-purpose description

CleanShield blocks known adult-content domains, applies SafeSearch URL settings on supported search engines, and provides user controls for protection modes, a domain allowlist, and optional settings lock.

## Data handling that must be disclosed

The extension locally processes top-level website navigation hostnames to implement blocking and display the requested hostname on the blocked page. A short-lived hostname and timestamp are stored in Chrome session storage until an ordinary navigation commits, the blocked page consumes the value, or the entry becomes stale. CleanShield also stores settings, allowlist entries, an optional salted password verifier, an aggregate blocked count, and local operational status.

The current implementation is intended not to send this browsing-related information to a CleanShield server or analytics/advertising services. This must be re-confirmed against the final code before submission.

Google's user-data FAQ says local processing/storage still counts as handling user data and must be disclosed. The developer must use the dashboard's current definitions and accurately disclose website domains/browsing activity handled locally, even if the information is not transmitted externally.

## Permission justifications to adapt

- `declarativeNetRequest`: applies the packaged adult-domain redirect/block rules and supported SafeSearch URL modifications.
- `storage`: saves settings, allowlist, password verifier, status, and temporary blocked-page hostname metadata.
- `webNavigation`: observes top-level navigation events to manage temporary hostname information for the blocked page.
- `tabs`: used by the blocked page to open a new tab when there is no previous page to return to. Confirm it is still used in final code.
- Host access `<all_urls>`: allows all-site domain protection and navigation URL observations required by the extension's intended behavior. Keep only if the current implementation needs it; consider whether narrower access can satisfy the feature.

## Policy URL

Paste the public, working URL of the repository's `PRIVACY-POLICY.md` into the dedicated privacy-policy field in the dashboard. Verify it loads while signed out or in an Incognito window.
