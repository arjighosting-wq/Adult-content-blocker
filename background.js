/**
 * CleanShield background service worker (MV3).
 *
 * Responsibilities:
 *   - Apply declarativeNetRequest rules (blocklist + allowlist + SafeSearch).
 *   - Detect blocked navigations and surface the CleanShield block page.
 *   - Manage settings, admin password, and locked mode.
 *   - Emit a heartbeat for tamper/disable detection (aggregate only; no history).
 *
 * Privacy: we never store browsing history. Only an aggregate block counter and
 * the hostname plus timestamp of the single most recent blocked navigation
 * (cleared when the block page reads it) are kept in local storage.
 */

import { normalizeHost, toDnrAllowRules, MAX_DYNAMIC_RULES } from './lib/filtering.js';

const RULES_ALLOWLIST = chrome.runtime.getURL('rules/allowlist.json');
const RULES_METADATA = chrome.runtime.getURL('rules/metadata.json');
const OWNED_STATIC_RULESETS = ['adult_strict', 'adult_balanced'];
const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html');

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'balanced',
  locked: false,
  adminHash: null,
  allowlist: [],
  blockedCount: 0,
  heartbeat: 0,
};

let embeddedAllow = [];
let blocklistMeta = {
  strictRuleCount: 0,
  balancedRuleCount: 0,
  strictDomainCount: 0,
  balancedDomainCount: 0,
};
let initialized = false;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

async function persistBlockStats() {
  const s = await getSettings();
  await chrome.storage.local.set({
    settings: { ...s, blockedCount: s.blockedCount + 1 },
  });
}

async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const enc = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    key,
    256
  );
  const hex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { salt: saltHex, iterations: 150000, hash: hex };
}

async function verifyPassword(password, record) {
  if (!record || !record.hash) return false;
  const salt = new Uint8Array(
    (record.salt.match(/.{2}/g) || []).map((h) => parseInt(h, 16))
  );
  const expected = await hashPassword(password, salt);
  return expected.hash === record.hash;
}

function settingsAllowedToChange(s) {
  return !s.locked;
}

function errInfo(err) {
  return {
    name: (err && err.name) || 'Error',
    message: err && err.message != null ? String(err.message) : String(err),
  };
}

function normalizeAllowlistDomain(value) {
  const host = normalizeHost(value);
  if (!host || host.length > 253 || !host.includes('.') || /[^a-z0-9._-]/i.test(host)) return null;
  const labels = host.split('.');
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
    return null;
  }
  return host;
}

function staticRulesetForMode(mode, enabled) {
  if (!enabled) return [];
  if (mode === 'strict') return ['adult_strict'];
  if (mode === 'balanced') return ['adult_balanced'];
  return [];
}

function staticRuleCountForMode(mode, enabled) {
  if (!enabled) return 0;
  if (mode === 'strict') return Number(blocklistMeta.strictRuleCount) || 0;
  if (mode === 'balanced') return Number(blocklistMeta.balancedRuleCount) || 0;
  return 0;
}

/**
 * Enable the selected packaged blocklist and keep only small user-specific
 * exceptions plus SafeSearch in the dynamic ruleset. The large adult lists are
 * static DNR rulesets so Chrome can index them from disk instead of rebuilding
 * hundreds of thousands of domain checks every service-worker startup.
 */
async function applyRulesInternal() {
  const s = await getSettings();
  const desiredStatic = staticRulesetForMode(s.mode, s.enabled);
  const currentlyEnabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  const enableRulesetIds = desiredStatic.filter((id) => !currentlyEnabled.includes(id));
  const disableRulesetIds = OWNED_STATIC_RULESETS.filter(
    (id) => currentlyEnabled.includes(id) && !desiredStatic.includes(id)
  );

  if (enableRulesetIds.length || disableRulesetIds.length) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds,
      disableRulesetIds,
    });
  }

  const safeRules = s.enabled ? safeSearchRules() : [];
  const rawAllowlist = s.enabled ? [...embeddedAllow, ...(s.allowlist || [])] : [];
  const uniqueAllowlist = [];
  const seenAllowlist = new Set();
  let invalidAllowlist = 0;
  for (const entry of rawAllowlist) {
    const host = normalizeAllowlistDomain(entry);
    if (!host) {
      invalidAllowlist += 1;
      continue;
    }
    if (!seenAllowlist.has(host)) {
      seenAllowlist.add(host);
      uniqueAllowlist.push(host);
    }
  }

  const allowBudget = Math.max(0, MAX_DYNAMIC_RULES - safeRules.length);
  const { rules: allowRules, omittedAllow } = toDnrAllowRules(
    uniqueAllowlist,
    1,
    allowBudget
  );
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  const dynamicRules = [...allowRules, ...safeRules];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: dynamicRules,
  });

  const effectiveStaticCount = staticRuleCountForMode(s.mode, s.enabled);
  const warningParts = [];
  if (invalidAllowlist) warningParts.push(`ignored ${invalidAllowlist} invalid allowlist entr${invalidAllowlist === 1 ? 'y' : 'ies'}`);
  if (omittedAllow) warningParts.push(`omitted ${omittedAllow} allowlist entries due to Chrome's dynamic-rule budget`);
  const ruleWarning = warningParts.join('; ');
  const planned = {
    mode: s.mode,
    enabled: s.enabled,
    staticRuleset: desiredStatic[0] || null,
    staticRules: effectiveStaticCount,
    allowlistRules: allowRules.length,
    safeSearchRules: safeRules.length,
    total: effectiveStaticCount + dynamicRules.length,
  };

  console.info('[CleanShield] packaged rulesets and dynamic rules synced', planned);
  await chrome.storage.local.set({
    ruleState: {
      count: planned.total,
      staticRuleCount: effectiveStaticCount,
      dynamicRuleCount: dynamicRules.length,
      allowlistRuleCount: allowRules.length,
      safeSearchRuleCount: safeRules.length,
      planned,
      warning: ruleWarning,
      ok: true,
      appliedAt: Date.now(),
    },
  });
}

async function applyRules() {
  try {
    await applyRulesInternal();
  } catch (err) {
    const info = errInfo(err);
    await chrome.storage.local.set({
      ruleState: {
        count: 0,
        ok: false,
        error: info,
        warning: '',
        appliedAt: Date.now(),
      },
    });
    throw err;
  }
}

function safeSearchRules() {
  const rules = [];
  let id = 60000;
  const defs = [
    {
      host: 'google',
      filter: '^https?://([^/]*\\.)?google\\.[a-z.]+\\.?/search\\?(?:[^#]*\\bq=([^&#]*))?.*',
      sub: 'https://www.google.com/search?q=\\2&safe=active',
    },
    {
      host: 'bing',
      filter: '^https?://([^/]*\\.)?bing\\.com/search\\?(?:[^#]*\\bq=([^&#]*))?.*',
      sub: 'https://www.bing.com/search?q=\\2&adlt=strict',
    },
    {
      host: 'duckduckgo',
      filter: '^https?://([^/]*\\.)?duckduckgo\\.com(?:/(?:search)?)?\\?(?:[^#]*\\bq=([^&#]*))?.*',
      sub: 'https://duckduckgo.com/?q=\\2&kp=1',
    },
    {
      host: 'yandex',
      filter: '^https?://([^/]*\\.)?yandex\\.(com|ru)(?:/(?:search)/?)?\\?(?:[^#]*\\btext=([^&#]*))?.*',
      sub: 'https://yandex.ru/search/?text=\\3&family=1',
    },
  ];
  for (const d of defs) {
    rules.push({
      id: id++,
      priority: 50,
      action: { type: 'redirect', redirect: { regexSubstitution: d.sub } },
      condition: { regexFilter: d.filter, resourceTypes: ['main_frame'] },
    });
  }
  return rules;
}

/* ------------------------------------------------------------------ */
/* block page plumbing                                                 */
/* ------------------------------------------------------------------ */

function isCleanShieldBlockedPage(urlString) {
  try {
    const actual = new URL(urlString);
    const expected = new URL(BLOCKED_PAGE_URL);
    return actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname;
  } catch {
    return false;
  }
}

// webNavigation has no onBeforeRedirect event. Capture only one transient
// hostname per tab at the start of a top-level web navigation; a successful
// ordinary navigation clears it on commit. When a DNR rule redirects to our
// block page, blocked.js asks for the hostname and this entry is consumed.
// We store hostnames in session storage (not local storage) and never keep a
// browsing-history list.
const NAV_CANDIDATE_TTL_MS = 15_000;
const NAV_CANDIDATE_PREFIX = 'cleanshieldNavCandidate:';
const candidateWrites = new Map();

function candidateKey(tabId) {
  return `${NAV_CANDIDATE_PREFIX}${tabId}`;
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0 || !Number.isInteger(details.tabId) || details.tabId < 0) return;
  let url;
  try {
    url = new URL(details.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const host = normalizeHost(url.hostname);
  if (!host) return;
  const key = candidateKey(details.tabId);
  const candidate = { host, ts: Date.now() };
  const write = chrome.storage.session.set({ [key]: candidate });
  candidateWrites.set(details.tabId, write);
  try {
    await write;
  } finally {
    if (candidateWrites.get(details.tabId) === write) candidateWrites.delete(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0 || !Number.isInteger(details.tabId) || details.tabId < 0) return;
  const pendingWrite = candidateWrites.get(details.tabId);
  if (pendingWrite) await pendingWrite.catch(() => {});
  // A DNR block redirect commits the extension block page. Leave the matching
  // candidate for blocked.js to retrieve. Any ordinary commit clears it.
  if (isCleanShieldBlockedPage(details.url)) return;
  await chrome.storage.session.remove(candidateKey(details.tabId));
});

/* ------------------------------------------------------------------ */
/* settings UI messages                                                */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureInit()
    .then(() => handleMessage(msg, sender))
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // async response
});

async function handleMessage(msg, sender = {}) {
  switch (msg.type) {
    case 'getBlockedPageDetails': {
      const senderUrl = sender.url || sender.tab?.url || '';
      if (!isCleanShieldBlockedPage(senderUrl)) throw new Error('not-block-page');
      const tabId = sender.tab?.id;
      if (!Number.isInteger(tabId) || tabId < 0) return { pendingBlock: null };
      const pendingWrite = candidateWrites.get(tabId);
      if (pendingWrite) await pendingWrite.catch(() => {});
      const key = candidateKey(tabId);
      const stored = await chrome.storage.session.get(key);
      const candidate = stored[key];
      await chrome.storage.session.remove(key);
      candidateWrites.delete(tabId);
      if (!candidate || !candidate.host || Date.now() - candidate.ts > NAV_CANDIDATE_TTL_MS) {
        return { pendingBlock: null };
      }
      await persistBlockStats();
      return { pendingBlock: { host: candidate.host, ts: candidate.ts } };
    }

    case 'getStatus': {
      const s = await getSettings();
      const rs = (await chrome.storage.local.get('ruleState')).ruleState || {};
      let ruleWarning = '';
      if (rs.ok === false) {
        const a = rs.error ? rs.error.name + ': ' + rs.error.message : 'unknown error';
        const b = rs.fallbackError
          ? ' Fallback ' + rs.fallbackError.name + ': ' + rs.fallbackError.message
          : '';
        ruleWarning = 'Rule install failed. ' + a + b;
      } else if (rs.warning) {
        ruleWarning = rs.warning;
      } else if (rs.usedFallback && rs.error) {
        ruleWarning = 'SafeSearch rules skipped (' + rs.error.name + ': ' + rs.error.message + ')';
      }
      return {
        status: {
          enabled: s.enabled,
          mode: s.mode,
          locked: s.locked,
          hasAdminPassword: Boolean(s.adminHash),
          allowlist: s.allowlist,
          blockedCount: s.blockedCount,
          heartbeat: s.heartbeat,
          rulesApplied: rs.count || 0,
          engine: 'declarativeNetRequest',
          ruleWarning,
        },
      };
    }

    case 'toggleEnabled': {
      const s = await getSettings();
      if (!settingsAllowedToChange(s)) {
        throw new Error('locked');
      }
      const next = await setSettings({ enabled: Boolean(msg.enabled) });
      await applyRules();
      return { status: next };
    }

    case 'setMode': {
      const s = await getSettings();
      if (!settingsAllowedToChange(s)) throw new Error('locked');
      const modes = ['strict', 'balanced', 'custom'];
      if (!modes.includes(msg.mode)) throw new Error('invalid-mode');
      const next = await setSettings({ mode: msg.mode });
      await applyRules();
      return { status: next };
    }

    case 'setPassword': {
      const s = await getSettings();
      const password = typeof msg.password === 'string' ? msg.password : '';
      if (password.length < 8) throw new Error('password-too-short');
      if (s.adminHash && !(await verifyPassword(msg.currentPassword || '', s.adminHash))) {
        throw new Error('invalid-current-password');
      }
      const next = await setSettings({ adminHash: await hashPassword(password) });
      return { status: { hasAdminPassword: Boolean(next.adminHash) } };
    }

    case 'unlock': {
      const s = await getSettings();
      if (!(await verifyPassword(msg.password || '', s.adminHash))) throw new Error('invalid-password');
      await setSettings({ locked: false });
      return { unlocked: true };
    }

    case 'lock': {
      const s = await getSettings();
      if (!s.adminHash) throw new Error('set-admin-password-first');
      if (!settingsAllowedToChange(s)) throw new Error('locked');
      await setSettings({ locked: true });
      return { locked: true };
    }

    case 'addAllowlist': {
      const s = await getSettings();
      if (!settingsAllowedToChange(s)) throw new Error('locked');
      const host = normalizeAllowlistDomain(msg.domain);
      if (!host) throw new Error('invalid-domain');
      if (s.allowlist.includes(host)) return { status: s };
      const next = await setSettings({ allowlist: [...s.allowlist, host] });
      await applyRules();
      return { status: next };
    }

    case 'removeAllowlist': {
      const s = await getSettings();
      if (!settingsAllowedToChange(s)) throw new Error('locked');
      const nextList = s.allowlist.filter((d) => d !== msg.domain);
      const next = await setSettings({ allowlist: nextList });
      await applyRules();
      return { status: next };
    }

    default:
      throw new Error('unknown-message');
  }
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function loadRules() {
  const [allowResult, metadataResult] = await Promise.allSettled([
    fetch(RULES_ALLOWLIST).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} loading allowlist`);
      return r.json();
    }),
    fetch(RULES_METADATA).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} loading blocklist metadata`);
      return r.json();
    }),
  ]);
  embeddedAllow = allowResult.status === 'fulfilled' && Array.isArray(allowResult.value)
    ? allowResult.value
    : [];
  if (metadataResult.status === 'fulfilled' && metadataResult.value && typeof metadataResult.value === 'object') {
    blocklistMeta = { ...blocklistMeta, ...metadataResult.value };
  } else {
    console.warn('[CleanShield] blocklist metadata could not be loaded; rule counts may be unavailable');
  }
}

let initPromise = null;

async function runInit() {
  try {
    await loadRules();
  } catch (err) {
    const info = errInfo(err);
    console.error('[CleanShield] failed to load embedded rules', info.name + ': ' + info.message);
  }
  await setSettings({ heartbeat: Date.now() });
  await chrome.storage.local.set({ lastHeartbeat: Date.now() });
  try {
    await applyRules();
  } catch (err) {
    const info = errInfo(err);
    console.error('[CleanShield] failed to apply rules on startup', info.name + ': ' + info.message);
  }
  initialized = true;
}

function ensureInit() {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInit();
});
chrome.runtime.onStartup.addListener(() => {
  ensureInit();
});
ensureInit();
