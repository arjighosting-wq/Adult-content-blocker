# CleanShield Privacy Policy

**Effective date:** October 25, 2026

CleanShield is a Chrome extension that blocks domains in its packaged adult-content lists, applies SafeSearch settings to supported search engines, and lets users manage an allowlist and optional settings lock.

## Data CleanShield processes

CleanShield processes some browsing-related information locally in Chrome so its blocking and blocked-page features can work:

- **Temporary website hostname:** When a top-level HTTP or HTTPS navigation begins, CleanShield temporarily stores that tab's hostname and a timestamp in Chrome's session storage. This is used to show the hostname on CleanShield's blocked page if the navigation is redirected there. CleanShield does not save the full URL, its path, or its query string in this temporary entry. The entry is removed when an ordinary navigation commits or when the blocked page retrieves it. A stale entry is not displayed if it is older than the extension's short validity window.
- **Settings and allowlist:** CleanShield stores the user's selected mode, whether protection is enabled, lock state, allowlisted hostnames, and related settings in Chrome's local extension storage.
- **Optional settings password verifier:** If the user sets an administrator password, CleanShield stores a salted PBKDF2-SHA-256 password hash and its parameters in local extension storage. It does not store the original password.
- **Aggregate blocked count and operational status:** CleanShield stores a blocked-page counter and limited rule/initialization status information locally to display settings status and troubleshoot rule installation. It does not maintain a persistent list of visited websites.

## How information is used

The information above is used only to provide CleanShield's blocking, blocked-page hostname, settings, allowlist, password-lock, and rule-status features.

CleanShield's SafeSearch rules modify supported search URLs by adding the relevant SafeSearch parameter. Search requests are still handled by the search engine the user visits; CleanShield does not send search terms to a CleanShield server.

## Sharing and transmission

CleanShield does not operate a developer-controlled account or analytics server and, in the extension code, does not transmit the browsing-related information described above to the developer or to third-party analytics or advertising services. The information is stored in the user's Chrome extension storage on their device. The extension does not sell or share this information.

The extension includes a blocklist sourced from The Block List Project. The list is packaged with the extension; CleanShield does not send a user's browsing activity to that project.

## Retention and deletion

Temporary hostname entries are stored in Chrome session storage and are removed after a normal top-level navigation commits or when the blocked page reads the entry. Entries older than the validity window are ignored. Settings, the allowlist, the aggregate blocked count, password verifier, and operational status remain in Chrome's local extension storage until changed or removed. Users can clear CleanShield's locally stored data by removing the extension and clearing its stored extension data through Chrome, or by using Chrome's extension-data controls where available.

## Permissions

- **declarativeNetRequest:** applies packaged adult-domain blocking rules, allowlist exceptions, and SafeSearch redirects.
- **storage:** stores settings locally and temporarily stores the hostname needed for the blocked page.
- **webNavigation:** observes top-level navigation events to supply the blocked-page hostname and clear temporary entries.
- **tabs:** included in the extension's declared permissions; tab-related functionality is used for the blocked-page experience.
- **Host access (`<all_urls>`):** permits the extension to apply protection across websites and observe the navigation URL information needed for the blocking experience.

## Children's privacy

CleanShield is a general-purpose browser protection tool. It does not knowingly collect information from users through a developer-operated service.

## Changes to this policy

If CleanShield's data practices change, this policy will be updated before the changed practices are released. The effective date above will be updated accordingly.

## Contact

For privacy questions or support, use the contact email listed on CleanShield's Chrome Web Store listing. A contact address should be added to the listing before publication.
