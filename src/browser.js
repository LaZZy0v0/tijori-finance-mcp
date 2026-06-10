import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, '..', 'output', 'session.json');
const BASE_URL = 'https://www.tijorifinance.com';

// Default navigation timeout. domcontentloaded fires fast; the per-tool readiness
// wait (waitFor selector) is what actually gates parsing, so this is just a ceiling.
const NAV_TIMEOUT = 45000;

// Cap concurrent page navigations. A long multi-tool query fans out ~7 heavy
// company-page loads at once (5 of them the same URL); without a cap they contend
// for CPU/network and all blow past the timeout together. Queue the overflow.
const MAX_CONCURRENT_NAV = 3;
let _activeNav = 0;
const _navQueue = [];

function acquireNav() {
  if (_activeNav < MAX_CONCURRENT_NAV) {
    _activeNav++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _navQueue.push(resolve));
}

function releaseNav() {
  const next = _navQueue.shift();
  if (next) next();          // hand the slot straight to the next waiter
  else _activeNav--;
}

function isTimeout(err) {
  return err?.name === 'TimeoutError' || /Timeout.*exceeded/i.test(err?.message ?? '');
}

let _browser = null;
let _context = null;
let _initPromise = null;     // in-flight launch, shared so a cold burst launches once

async function ensureBrowser() {
  if (_browser?.isConnected()) return;
  // A launch is already underway — join it instead of starting a second one. The
  // check-then-assign below is synchronous (no await between), so concurrent callers
  // on a cold start can't both reach chromium.launch.
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    process.stderr.write('[tijori-mcp] launched Chromium\n');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: JSON.parse(readFileSync(SESSION_PATH, 'utf-8')),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });

    // Drop resources the parsers never read: images/media/fonts plus third-party
    // trackers (mixpanel, partytown, twitter/x embeds, analytics). These are the
    // exact things that used to keep the `load` event from firing and that starved
    // the page loads of bandwidth under burst. The site's own JS and /api XHRs pass
    // through, so client-rendered sections still build. (context.request /
    // page.request API calls bypass routing, so fetch_document etc. are unaffected.)
    await context.route('**/*', (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      if (/mixpanel|partytown|google-analytics|googletagmanager|doubleclick|cdn\.syndication|platform\.twitter|twitter\.com|\/\/x\.com/i.test(req.url())) {
        return route.abort();
      }
      return route.continue();
    });

    _browser = browser;
    _context = context;
  })();

  try {
    await _initPromise;
  } finally {
    _initPromise = null;     // cleared so a failed launch can be retried next call
  }
}

export async function withPage(fn) {
  await ensureBrowser();
  const page = await _context.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

// Loads a Tijori page and returns the open page object.
// CALLER MUST call closePage(page) when done.
//
// options.waitFor — a selector to wait for before returning, proving the data the
//   parser needs has actually rendered (e.g. 'table.dataTable', '.custom_ratio').
//   Returns complete data or surfaces a clear error — never a half-loaded page.
//   When omitted, falls back to a short settle for callers without a stable anchor.
export async function loadPage(url, { waitFor, timeout = NAV_TIMEOUT } = {}) {
  await ensureBrowser();

  const navigateAndReady = async () => {
    const page = await _context.newPage();
    try {
      const response = await page.goto(`${BASE_URL}${url}`, {
        waitUntil: 'domcontentloaded',
        timeout,
      });

      if (response?.status() === 403) {
        throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });
      }
      if (response?.status() === 404) {
        throw Object.assign(new Error(`Not found: ${url}`), { code: 'NOT_FOUND' });
      }

      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {});
      } else {
        await page.waitForTimeout(1500);
      }
      return page;
    } catch (err) {
      await page.close().catch(() => {});
      throw err;
    }
  };

  await acquireNav();
  try {
    try {
      return await navigateAndReady();
    } catch (err) {
      // Retry once on a transient navigation timeout; let everything else bubble.
      if (isTimeout(err)) return await navigateAndReady();
      throw err;
    }
  } finally {
    releaseNav();
  }
}

export async function closePage(page) {
  await page.close().catch(() => {});
}

export async function browserFetch(url, options = {}) {
  return withPage(async (page) => {
    // Navigate to base so session cookies are in scope for fetch(). Gate it through
    // the same nav semaphore so it shares the concurrency budget with loadPage.
    await acquireNav();
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    } finally {
      releaseNav();
    }

    const result = await page.evaluate(async ({ url, options }) => {
      const res = await fetch(url, {
        credentials: 'include',
        ...options,
      });
      const text = await res.text();
      return { status: res.status, body: text };
    }, { url, options });

    if (result.status === 403) {
      throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });
    }
    if (result.status === 404) {
      throw Object.assign(new Error(`Not found: ${url}`), { code: 'NOT_FOUND' });
    }

    try { return JSON.parse(result.body); }
    catch { return result.body; }
  });
}

// Runs fn with the authenticated browser context directly (no page opened).
// Use when you only need context.request — avoids the overhead of a full page.
export async function withContext(fn) {
  await ensureBrowser();
  return fn(_context);
}

export async function closeBrowser() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; _context = null; }
}
