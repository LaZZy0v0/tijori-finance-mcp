import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, '..', 'output', 'session.json');
const BASE_URL = 'https://www.tijorifinance.com';

let _browser = null;
let _context = null;

async function ensureBrowser() {
  if (_browser?.isConnected()) return;
  _browser = await chromium.launch({ headless: true });
  _context = await _browser.newContext({
    storageState: JSON.parse(readFileSync(SESSION_PATH, 'utf-8')),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
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
export async function loadPage(url) {
  await ensureBrowser();
  const page = await _context.newPage();
  try {
    const response = await page.goto(`${BASE_URL}${url}`, {
      waitUntil: 'load',
      timeout: 30000,
    });

    if (response?.status() === 403) {
      throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });
    }
    if (response?.status() === 404) {
      throw Object.assign(new Error(`Not found: ${url}`), { code: 'NOT_FOUND' });
    }

    await page.waitForTimeout(1500);
    return page;
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

export async function closePage(page) {
  await page.close().catch(() => {});
}

export async function browserFetch(url, options = {}) {
  return withPage(async (page) => {
    // Navigate to base so session cookies are in scope for fetch()
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
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

export async function closeBrowser() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; _context = null; }
}
