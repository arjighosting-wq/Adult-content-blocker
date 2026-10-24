# CleanShield — Adult Content Blocker 🛡️

**CleanShield** is a fast, lightweight, and privacy-focused Chrome Extension (Manifest V3) designed to block adult websites, enforce SafeSearch, and protect browsing environments without logging or tracking user activity.

---

## ✨ Features

* **Privacy First:** CleanShield never logs or saves browsing history. Only an aggregate block count is retained locally.
* **Declarative Net Request Engine:** Built using modern MV3 APIs for high performance and low system overhead.
* **Flexible Filtering Modes:**
  * **Strict:** Maximum filtering using high-confidence adult blocklists.
  * **Balanced:** Standard protection against adult domains.
  * **Custom:** Filtering based on SafeSearch and your personal allowlist.
* **SafeSearch Enforcement:** Enforces strict SafeSearch automatically on Google, Bing, DuckDuckGo, and Yandex.
* **Admin Password & Lock Mode:** Protect settings with a PBKDF2-hashed password to prevent unauthorized disabling or allowlist changes.
* **Custom Allowlist:** Easily whitelist trusted websites.

---

## 🛠️ Project Structure

* `manifest.json` — Extension configuration & permissions (Manifest V3).
* `background.js` — Service worker handling rule updates, navigation interception, and status messaging.
* `options.html` & `options.js` — Control panel for mode selection, allowlist management, and password protection.
* `blocked.html` & `blocked.js` — Clean redirection block page.
* `clean.css` — Modern Dark UI design system.
* `lib/filtering.js` — Core domain normalization and rule compilation.
* `rules/` — JSON datasets for strict, balanced, and allowlist rules.

---

## 🚀 How to Install (Developer Mode)

1. **Clone or download** this repository to your computer.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `CleanShield` folder containing `manifest.json`.

---

## 🔒 Privacy & Security

CleanShield runs 100% locally on your browser. No personal data, telemetry, or site tracking information is ever collected or sent to external servers.

## 📸 Preview

### Forced SafeSearch Enforcement
SafeSearch is automatically enabled and locked across search engines to prevent explicit search results:

## Screenshots

### Settings
![CleanShield settings](assets/screenshots/cleanshield-settings.png)

### Blocked page
![CleanShield blocked page](assets/screenshots/blocked-page.png)

### SafeSearch
![SafeSearch test](assets/screenshots/safesearch-test.png)