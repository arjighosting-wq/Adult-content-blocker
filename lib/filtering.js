/**
 * Self-contained domain filtering logic for the CleanShield browser extension.
 *
 * This module intentionally has zero imports so it can run inside a MV3
 * service worker, a Firefox background script, Safari's app extension, and the
 * Node.js test-suite unchanged.
 *
 * Semantics mirror the shared filtering engine:
 *   - a blocklist entry `adult.example.com` blocks that domain and all subdomains
 *   - allowlist entries override blocklist entries
 *   - label-boundary matching (never matches `notadult.example.com` for
 *     `adult.example.com`)
 */

export const SEARCH_ENGINES = [
  { id: 'google', hosts: ['google.com', 'google.co.uk', 'google.de', 'google.fr', 'google.ca', 'google.com.au'], param: 'safe', value: 'active' },
  { id: 'bing', hosts: ['bing.com'], param: 'adlt', value: 'strict' },
  { id: 'duckduckgo', hosts: ['duckduckgo.com'], param: 'kp', value: '1' },
  { id: 'yandex', hosts: ['yandex.ru', 'yandex.com'], param: 'family', value: '1' },
];

/** Normalizes a hostname: lowercase, strip trailing dot, strip port. */
export function normalizeHost(input) {
  let s = String(input || '').toLowerCase().trim();
  if (s.startsWith('[')) {
    const close = s.indexOf(']');
    if (close !== -1) s = s.slice(0, close + 1);
  } else {
    const colon = s.lastIndexOf(':');
    if (colon !== -1 && s.split(':').length === 2) {
      const rest = s.slice(colon + 1);
      if (/^\d+$/.test(rest)) s = s.slice(0, colon);
    }
  }
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s;
}

/** Builds a lookup table from blocklist/allowlist patterns. */
export function compileRules(patterns) {
  const map = new Map();
  for (const p of patterns || []) {
    const host = normalizeHost(p);
    if (!host || host === '*' || host === '.') continue;
    const labels = host.split('.');
    if (labels.length < 2) continue;
    // store reversed labels joined by '.' for suffix matching
    map.set(labels.slice().reverse().join('.'), true);
  }
  return map;
}

/** Suffix-match: is `host` equal to `pattern` or a subdomain of it? */
function suffixMatch(revPattern, host) {
  const labels = host.split('.');
  const patternLabels = revPattern.split('.');
  if (labels.length < patternLabels.length) return false;
  for (let i = 0; i < patternLabels.length; i++) {
    if (labels[labels.length - 1 - i] !== patternLabels[i]) return false;
  }
  return true;
}

/** Returns true when `host` (or a parent of it) is present in the rule map. */
export function matchesRules(ruleMap, host) {
  const h = normalizeHost(host);
  if (!h) return false;
  const labels = h.split('.');
  for (let i = 0; i < labels.length; i++) {
    const suffix = labels.slice(i).reverse().join('.');
    if (ruleMap.has(suffix)) return true;
  }
  return false;
}

/** Decision result. */
export function decide(blocklist, allowlist, host) {
  const h = normalizeHost(host);
  if (!h) return { action: 'allow', host: '', reason: 'malformed' };
  if (matchesRules(allowlist, h)) return { action: 'allow', host: h, reason: 'allowlist' };
  if (matchesRules(blocklist, h)) return { action: 'block', host: h, reason: 'blocklist' };
  return { action: 'allow', host: h, reason: 'unknown' };
}

/** The search engine whose safe-search mode should be forced for this host. */
export function engineForHost(host) {
  const h = normalizeHost(host);
  for (const e of SEARCH_ENGINES) {
    for (const hostname of e.hosts) {
      if (h === hostname || h.endsWith('.' + hostname)) return e;
    }
  }
  return null;
}

/**
 * Returns a SafeSearch-enforcing URL for a search engine request, or null when
 * the request already has the correct parameter.
 */
export function safeSearchRedirect(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const engine = engineForHost(parsed.hostname);
  if (!engine) return null;
  const current = parsed.searchParams.get(engine.param);
  if (current === engine.value) return null;
  parsed.searchParams.set(engine.param, engine.value);
  return parsed.toString();
}

/**
 * Sub-resource types blocked (without a visible redirect) for a blocked domain.
 * Main-frame navigations are redirected to the block page instead; the native
 * apps filter at DNS, so everything else to the same domain is dropped too.
 */
const SUBRESOURCE_TYPES = [
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'other',
];

export const MAX_DYNAMIC_RULES = 5000;
export const SAFE_SEARCH_RULE_RESERVE = 4;

/**
 * Converts rule patterns into declarativeNetRequest rules.
 * `ruleIdBase` starts the id sequence; ids must be unique.
 * `maxRules` is the combined budget for block + allow rules. The caller must
 * reserve SafeSearch capacity before passing this value. Allowlist patterns
 * are allocated first so exceptions are not dropped to fit extra block rules.
 */
export function toDnrRules(blocklistPatterns, allowlistPatterns, ruleIdBase = 1, maxRules = MAX_DYNAMIC_RULES) {
  const rules = [];
  let id = ruleIdBase;
  const urlFilterFor = (pattern) => '||' + pattern + '^';
  const blockPatterns = Array.isArray(blocklistPatterns) ? blocklistPatterns : [];
  const allowPatterns = Array.isArray(allowlistPatterns) ? allowlistPatterns : [];
  const budget = Math.max(0, Number(maxRules) || 0);

  const maxAllow = Math.min(allowPatterns.length, budget);
  const remaining = budget - maxAllow;
  const maxBlockPatterns = Math.floor(remaining / 2);
  const usedAllow = allowPatterns.slice(0, maxAllow);
  const usedBlock = blockPatterns.slice(0, maxBlockPatterns);
  const omittedBlock = blockPatterns.length - usedBlock.length;
  const omittedAllow = allowPatterns.length - usedAllow.length;

  const blockRuleIds = [];
  for (const p of usedBlock) {
    const urlFilter = urlFilterFor(p);
    const redirectId = id++;
    blockRuleIds.push(redirectId);
    rules.push({
      id: redirectId,
      priority: 100,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
      condition: { urlFilter, resourceTypes: ['main_frame'] },
    });
    const blockId = id++;
    blockRuleIds.push(blockId);
    rules.push({
      id: blockId,
      priority: 100,
      action: { type: 'block' },
      condition: { urlFilter, resourceTypes: SUBRESOURCE_TYPES },
    });
  }

  const allowRuleIds = [];
  for (const p of usedAllow) {
    const idNow = id++;
    allowRuleIds.push(idNow);
    rules.push({
      id: idNow,
      priority: 200,
      action: { type: 'allow' },
      condition: { urlFilter: urlFilterFor(p) },
    });
  }
  return { rules, blockRuleIds, allowRuleIds, omittedBlock, omittedAllow };
}
