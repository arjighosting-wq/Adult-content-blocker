# CleanShield Privacy Policy

**Effective date:** November 14, 2026

CleanShield is a Chrome extension that blocks domains in its packaged adult-content lists, applies SafeSearch settings to supported search engines, and lets users manage an allowlist and optional settings lock.

## Data CleanShield processes

CleanShield processes limited browsing-related information locally in Chrome to provide its blocked-page feature:

- **Temporary website hostname:** Only while protection is enabled in **Strict** or **Balanced** mode, CleanShield's navigation listener handles top-level HTTP and HTTPS navigation events. It extracts the hostname and temporarily stores that hostname and a timestamp in Chrome's session storage so the blocked page can identify the site if a packaged rule redirects the navigation. It does not store the page path, query string, search terms, or page content in this entry. An ordinary navigation commit, a failed navigation, or tab closure removes the candidate; if CleanShield's blocked page opens, that page retrieves and consumes the candidate. A candidate older than 15 seconds is not displayed. Hostname capture is disabled when protection is off or Custom mode is selected.
- **Settings and allowlist:** CleanShield stores the selected mode, whether protection is enabled, lock state, allowlisted hostnames, and related settings in Chrome's local extension storage.
- **Optional settings password verifier:** If the user sets an administrator password, CleanShield stores a salted PBKDF2-SHA-256 password hash and its parameters in local extension storage. It does not store the original password.
- **Aggregate blocked count and operational status:** CleanShield stores an aggregate blocked-page counter and limited rule/initialization status information locally. It does not maintain a persistent list of visited websites.

## How information is used

The information above is used only to provide CleanShield's adult-domain blocking, blocked-page hostname, settings, allowlist, password-lock, and rule-status features.

CleanShield's SafeSearch rules modify supported search URLs by adding the relevant SafeSearch parameter. Search requests are still handled by the search engine the user visits; CleanShield does not send search terms to a CleanShield server.

## Sharing and transmission

CleanShield does not operate a developer-controlled account or analytics server. The extension code does not transmit the browsing-related information described above to the developer or to third-party analytics or advertising services. Temporary hostnames and settings remain in Chrome's extension storage on the user's device. CleanShield does not sell or share this information.

CleanShield includes packaged adult-domain rules derived from two public community-maintained sources: ShadowWhisperer / BlockLists (Unlicense) and Sinfonietta / hostfiles (MIT). Source attribution and licence notices are included with the extension, and the source snapshots and reproducible generation files are maintained in the public source repository. CleanShield does not send a user's browsing activity to either source project.

## Chrome Web Store User Data Policy

CleanShield's collection, use, and handling of information received from Chrome APIs are limited to providing the features described in this policy and in the extension. This use adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Retention and deletion

Temporary hostname candidates are kept in Chrome session storage only for the active browser session and are cleared on an ordinary navigation commit, navigation error, tab closure, or when the blocked page retrieves them. Candidates older than 15 seconds are ignored by the blocked page. Settings, allowlist entries, aggregate blocked count, password verifier, and operational status remain in Chrome's local extension storage until changed or removed. Users can remove CleanShield and clear its stored extension data through Chrome's extension controls.

## Permissions

CleanShield requests the following permissions for its current features:

- **declarativeNetRequest:** applies packaged adult-domain blocking rules, allowlist exceptions, and SafeSearch redirects.
- **storage:** stores settings and allowlist data locally and temporarily stores the hostname candidate used by the blocked page.
- **webNavigation:** handles top-level HTTP and HTTPS navigation events while protection is enabled in Strict or Balanced mode, solely to obtain the hostname for a blocked-page notice and clear the temporary candidate.
- **Host access (`http://*/*` and `https://*/*`):** allows CleanShield's declarative network rules to redirect matching adult-domain navigations to its blocked page and modify supported search-engine URLs. It does not inject scripts into pages or read page content.

## Children's privacy

CleanShield is a general-purpose browser protection tool. It does not operate a developer-controlled account service and does not knowingly collect information from users through such a service.

## Changes to this policy

If CleanShield's data practices change, this policy will be updated before the changed practices are released. The effective date above will be updated accordingly.

## Contact

For privacy questions or support, use the contact email displayed in CleanShield's Chrome Web Store listing.
