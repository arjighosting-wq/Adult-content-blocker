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

import {
  compileRules,
  decide,
  engineForHost,
  normalizeHost,
  toDnrRules,
} from './lib/filtering.js';

const RULES_STRICT = chrome.runtime.getURL('rules/strict.json');
const RULES_BALANCED = chrome.runtime.getURL('rules/balanced.json');
const RULES_ALLOWLIST = chrome.runtime.getURL('rules/allowlist.json');

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'balanced',
  locked: false,
  adminHash: null,
  allowlist: [],
  blockedCount: 0,
  heartbeat: 0,
};

let strictList = [];
let balancedList = [];
let embeddedAllow = [];
let allowlistMap = compileRules([]);
let activeBlockMap = compileRules([]);
let initialized = false;

/** Returns the raw blocklist domains for the given mode. */
function blocklistForMode(mode) {
  if (mode === 'strict') return strictList;
  if (mode === 'balanced') return balancedList;
  return [];
}

/** Rebuilds allowlistMap and activeBlockMap from current settings. */
async function refreshMaps() {
  const s = await getSettings();
  allowlistMap = compileRules([...embeddedAllow, ...(s.allowlist || [])]);
  activeBlockMap = compileRules(blocklistForMode(s.mode));
}

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

/* ------------------------------------------------------------------ */
/* rule application                                                    */
/* ------------------------------------------------------------------ */

async function applyRules() {
  const s = await getSettings();
  const blocklist = blocklistForMode(s.mode);
  const allowlist = [...embeddedAllow, ...(s.allowlist || [])];

  const { rules, blockRuleIds, allowRuleIds } = toDnrRules(
    s.enabled ? blocklist : [],
    allowlist,
    100,
    4900
  );

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);

  const coreRules = [...rules];
  const fullRules = s.enabled ? [...coreRules, ...safeSearchRules()] : coreRules;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: fullRules,
    });
  } catch (err) {
    // Some browsers reject the regex SafeSearch rules. Fall back to the core
    // blocklist/allowlist rules so protection still works.
    console.warn('[CleanShield] full ruleset rejected; retrying without SafeSearch', err);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: coreRules,
    });
  }

  await chrome.storage.local.set({
    ruleState: { blockRuleIds, allowRuleIds, count: fullRules.length, appliedAt: Date.now() },
  });
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
      filter: '^https?://([^/]*\\.)?duckduckgo\\.com(?:/(?:search))?\\?(?:[^#]*\\bq=([^&#]*))?.*',
      sub: 'https://duckduckgo.com/?q=\\2&kp=1',
    },
    {
      host: 'yandex',
      filter: '^https?://([^/]*\\.)?yandex\\.(com|ru)(?:/(?:search))?\\?(?:[^#]*\\btext=([^&#]*))?.*',
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

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (!initialized || details.frameId !== 0) return;
    const s = await getSettings();
    if (!s.enabled) return;
    let url;
    try {
      url = new URL(details.url);
    } catch {
      return;
    }
    const host = normalizeHost(url.hostname);
    const decision = decide(activeBlockMap, allowlistMap, host);
    if (decision.action !== 'block') return;
    await chrome.storage.local.set({
      pendingBlock: { host: decision.host, ts: Date.now() },
    });
    await persistBlockStats();
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

/* ------------------------------------------------------------------ */
/* settings UI messages                                                */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // async response
});

async function handleMessage(msg) {
  switch (msg.type) {
    case 'getStatus': {
      const s = await getSettings();
      return {
        status: {
          enabled: s.enabled,
          mode: s.mode,
          locked: s.locked,
          hasAdminPassword: Boolean(s.adminHash),
          allowlist: s.allowlist,
          blockedCount: s.blockedCount,
          heartbeat: s.heartbeat,
          rulesApplied: (await chrome.storage.local.get('ruleState')).ruleState?.count || 0,
          engine: 'declarativeNetRequest',
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
      await refreshMaps();
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
      const host = normalizeHost(msg.domain);
      if (!host || host.includes('*')) throw new Error('invalid-domain');
      if (s.allowlist.includes(host)) return { status: s };
      const next = await setSettings({ allowlist: [...s.allowlist, host] });
      await refreshMaps();
      await applyRules();
      return { status: next };
    }

    case 'removeAllowlist': {
      const s = await getSettings();
      if (!settingsAllowedToChange(s)) throw new Error('locked');
      const nextList = s.allowlist.filter((d) => d !== msg.domain);
      const next = await setSettings({ allowlist: nextList });
      await refreshMaps();
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
  const [strict, balanced, allow] = await Promise.all([
    fetch(RULES_STRICT).then((r) => r.json()),
    fetch(RULES_BALANCED).then((r) => r.json()),
    fetch(RULES_ALLOWLIST).then((r) => r.json()),
  ]);
  strictList = strict;
  balancedList = balanced;
  embeddedAllow = Array.isArray(allow) ? allow : [];
}

async function init() {
  try {
    await loadRules();
  } catch (err) {
    console.error('[CleanShield] failed to load embedded rules', err);
  }
  await setSettings({ heartbeat: Date.now() });
  await chrome.storage.local.set({ lastHeartbeat: Date.now() });
  await refreshMaps();
  try {
    await applyRules();
  } catch (err) {
    console.error('[CleanShield] failed to apply rules on startup', err);
  }
  initialized = true;
}

chrome.runtime.onInstalled.addListener(() => init());
chrome.runtime.onStartup.addListener(() => init());
init();
