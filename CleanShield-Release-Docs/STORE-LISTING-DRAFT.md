# CleanShield — Chrome Web Store listing draft

Use as a draft only. Check every statement against the final package before submitting. Google requires accurate metadata and screenshots; missing icon, description, or screenshots can cause rejection.

## Name

CleanShield — Adult Content Blocker

## Short description (manifest description must be at most 132 characters)

Blocks known adult domains, applies SafeSearch on supported search engines, and offers Strict, Balanced, and Custom modes.

## Detailed description

CleanShield helps you reduce access to known adult websites in Chrome and keep SafeSearch protections enabled on supported search engines.

**Features**
- **Strict mode:** uses the larger packaged adult-domain list.
- **Balanced mode:** uses a smaller curated starter list of known adult domains.
- **Custom mode:** disables automatic adult-domain blocking while keeping SafeSearch available.
- **SafeSearch:** applies supported search-engine URL settings for Google, Bing, DuckDuckGo, and Yandex.
- **Allowlist:** lets you add specific domains as exceptions, subject to the extension's settings and lock state.
- **Blocked page:** shows the hostname of the blocked website.
- **Local settings:** stores extension settings on your device.

**Privacy**
CleanShield processes website hostnames locally to provide blocking and the blocked-page experience. It stores settings, allowlist entries, an aggregate blocked count, and a temporary hostname/session entry for the block page. It does not send this browsing-related information to a CleanShield server, according to the current implementation. Read the linked privacy policy for details.

**Important limitations**
CleanShield relies on packaged domain lists and browser-level rules. It cannot guarantee that every adult website will be blocked, and users may encounter unlisted domains or false positives. SafeSearch behavior depends on supported search engines and their URL behavior.

## Suggested category

Productivity (confirm the current category options in the dashboard and choose the best match).

## Screenshot plan

1. Actual CleanShield settings page showing modes and enabled protection.
2. Actual CleanShield block page with a harmless test domain, if the UI is clean and clearly marked as a test.
3. SafeSearch demonstration using a harmless query such as `cats` and showing the relevant URL parameter.

Use screenshots of the actual extension—not mockups presented as real UI. At least one screenshot is required; Google's listing guide specifies 1280×800 px screenshots, up to five.

## Support and policy links

- Privacy policy URL: **Add the public GitHub URL for `PRIVACY-POLICY.md`**.
- Support email/contact: **Add an email the publisher monitors**.
- Homepage/support URL (optional): **Add public project repository or issue tracker, if desired**.
