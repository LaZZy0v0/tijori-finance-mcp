/**
 * Tijori Finance — API Discovery Spike
 *
 * Logs in automatically with email + password, saves the session.
 * Subsequent runs reuse the saved session (no login needed).
 * Results are written to output/discovered_endpoints.json
 *
 * Usage:
 *   cp .env.example .env        # fill in your credentials
 *   node discover.js            # first run: logs in and saves session
 *   node discover.js            # subsequent runs: uses saved session
 *   node discover.js --reauth   # force fresh login (if session expires)
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const env = {};
try {
  readFileSync(join(__dirname, '.env'), 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k?.trim()) env[k.trim()] = v.join('=').trim();
  });
} catch {
  console.error('Missing .env file — copy .env.example and fill in your credentials.');
  process.exit(1);
}

const EMAIL    = env.TIJORI_EMAIL;
const PASSWORD = env.TIJORI_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('TIJORI_EMAIL and TIJORI_PASSWORD must be set in .env');
  process.exit(1);
}

const BASE_URL     = 'https://www.tijorifinance.com';
const SESSION_PATH = join(__dirname, 'output', 'session.json');
const OUTPUT_PATH  = join(__dirname, 'output', 'discovered_endpoints.json');
const FORCE_REAUTH = process.argv.includes('--reauth');

const TEST_COMPANY = 'tata-steel-limited';

const PAGES_TO_VISIT = [
  `/company/${TEST_COMPANY}/`,
  `/company/${TEST_COMPANY}/financials/`,
  `/company/${TEST_COMPANY}/shareholding/`,
  `/company/${TEST_COMPANY}/benchmarking/`,
  `/company/${TEST_COMPANY}/reports/`,
  `/filter/`,
  `/markets`,
  `/macro`,
];

const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|gif|webp|map)(\?.*)?$/i;
const SKIP_HOSTS = ['google', 'analytics', 'gtag', 'facebook', 'hotjar', 'clarity', 'sentry', 'crisp', 'intercom', 'segment'];

function shouldCapture(url) {
  if (SKIP_EXTENSIONS.test(url)) return false;
  if (SKIP_HOSTS.some(h => url.includes(h))) return false;
  return true;
}

async function login() {
  console.log('   Attempting REST API login...');

  const loginPayload = {
    email: EMAIL,
    password: PASSWORD,
  };

  try {
    const response = await fetch(`${BASE_URL}/api/users/account/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(loginPayload),
    });

    if (!response.ok) {
      throw new Error(`Login failed with status ${response.status}`);
    }

    // Extract cookies from Set-Cookie headers (most reliable indicator of success)
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map(header => {
      const parts = header.split(';');
      const [name, value] = parts[0].split('=');
      
      // Parse cookie attributes
      const cookie = { 
        name: name.trim(), 
        value: value.trim(),
        domain: '.tijorifinance.com', // Default domain
        path: '/',
      };
      
      // Extract Path and Domain if present
      parts.slice(1).forEach(part => {
        const [key, val] = part.split('=').map(s => s.trim());
        if (key.toLowerCase() === 'path') {
          cookie.path = val;
        } else if (key.toLowerCase() === 'domain') {
          cookie.domain = val;
        }
      });
      
      return cookie;
    });

    // Verify sessionid cookie was set (required for authenticated requests)
    const hasSessionId = cookies.some(c => c.name === 'sessionid');
    if (!hasSessionId) {
      throw new Error('Login response missing sessionid cookie');
    }

    console.log(`   REST login successful! Got ${cookies.length} cookie(s) including sessionid.`);
    
    // Save session in Playwright format (compatible with existing auth.js)
    const sessionState = {
      cookies,
      origins: [{ origin: BASE_URL, localStorage: [] }],
    };

    writeFileSync(SESSION_PATH, JSON.stringify(sessionState, null, 2));
    console.log('   Session saved to output/session.json');
    return sessionState;
  } catch (err) {
    throw new Error(`REST login failed: ${err.message}`);
  }
}

async function main() {
  mkdirSync(join(__dirname, 'output'), { recursive: true });

  // Clear old session if --reauth flag is used
  if (FORCE_REAUTH && existsSync(SESSION_PATH)) {
    unlinkSync(SESSION_PATH);
    console.log('   Cleared old session file (--reauth flag used).');
  }

  const hasSavedSession = existsSync(SESSION_PATH) && !FORCE_REAUTH;

  // ── Step 1: Session ─────────────────────────────────────────────────────────
  console.log('\n[1/3] Session setup...');

  const browser = await chromium.launch({ headless: true }); // run in background

  let context;
  
  if (hasSavedSession) {
    console.log('   Reusing saved session (skipping login).');
    context = await browser.newContext({
      storageState: JSON.parse(readFileSync(SESSION_PATH, 'utf-8')),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });
  } else {
    console.log('   No saved session — logging in via REST API...');
    const sessionState = await login();
    context = await browser.newContext({
      storageState: sessionState,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });
  }

  // ── Step 2: Intercept + visit pages ─────────────────────────────────────────
  const capturedRequests = [];

  context.on('request', request => {
    const url = request.url();
    if (!shouldCapture(url)) return;
    if (!['xhr', 'fetch'].includes(request.resourceType())) return;

    capturedRequests.push({
      method: request.method(),
      url,
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData() || null,
      timestamp: new Date().toISOString(),
      page: null,
    });
  });

  context.on('response', async response => {
    const url = response.url();
    if (!shouldCapture(url)) return;
    if (!['xhr', 'fetch'].includes(response.request().resourceType())) return;

    const entry = capturedRequests.findLast(r => r.url === url && !r.status);
    if (!entry) return;

    entry.status = response.status();
    entry.responseHeaders = response.headers();

    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const body = await response.json().catch(() => null);
        entry.responseBodySample = body ? JSON.stringify(body).slice(0, 4000) : null;
        entry.responseKeys = body && typeof body === 'object' ? Object.keys(body) : [];
      } else if (ct.includes('html') || ct.includes('text')) {
        // Capture HTML fragments (e.g. op_metrics returns text/html)
        const text = await response.text().catch(() => null);
        entry.responseBodySample = text ? text.slice(0, 2000) : null;
        entry.isHtmlFragment = true;
      }
    } catch { /* ignore */ }
  });

  console.log('\n[2/3] Visiting pages and capturing API calls...');
  const page = await context.newPage();

  async function visit(label, path) {
    console.log(`   → ${label}`);
    const priorCount = capturedRequests.length;
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 30000 })
      .catch(e => console.warn(`     (timeout/error: ${e.message})`));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2000);
    capturedRequests.slice(priorCount).forEach(r => { r.page = label; });
    console.log(`     captured ${capturedRequests.length - priorCount} API calls`);
  }

  async function scrollSlowly() {
    // Scroll in steps to trigger intersection-observer lazy loads
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 300));
      }
    }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // ── 1. Trigger search autocomplete ──────────────────────────────────────────
  console.log(`   → [search autocomplete]`);
  const priorSearch = capturedRequests.length;
  await page.goto(`${BASE_URL}/dashboard/`, { waitUntil: 'load', timeout: 30000 })
    .catch(() => page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {}));
  await page.waitForTimeout(1500);

  // Try clicking / focusing the search input, then type
  const searchSelectors = [
    'input[placeholder*="Search" i]',
    'input[placeholder*="company" i]',
    'input[type="search"]',
    'input[name="q"]',
    '[class*="search"] input',
    '[class*="Search"] input',
    'input[autocomplete]',
  ];
  let searchTriggered = false;
  for (const sel of searchSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(500);
      await el.type('Reliance', { delay: 80 });
      await page.waitForTimeout(2500); // wait for autocomplete results
      searchTriggered = true;
      console.log(`     search triggered via: ${sel}`);
      break;
    }
  }
  if (!searchTriggered) console.warn('     could not find search input — skipping autocomplete capture');

  capturedRequests.slice(priorSearch).forEach(r => { r.page = 'search-autocomplete'; });
  console.log(`     captured ${capturedRequests.length - priorSearch} API calls`);

  // ── 2. Company overview ──────────────────────────────────────────────────────
  await visit('company-overview', `/company/${TEST_COMPANY}/`);

  // ── 3. Financials — scroll through all tabs ──────────────────────────────────
  console.log(`   → [financials + tab clicks]`);
  const priorFin = capturedRequests.length;
  await page.goto(`${BASE_URL}/company/${TEST_COMPANY}/financials/`, { waitUntil: 'load', timeout: 30000 })
    .catch(e => console.warn(`     (error: ${e.message})`));
  await page.waitForTimeout(2000);
  await scrollSlowly();

  // Click P&L, Balance Sheet, Cash Flow tabs if they exist
  const finTabs = ['P&L', 'Profit', 'Income', 'Balance Sheet', 'Cash Flow', 'Ratios', 'Quarterly'];
  for (const tabText of finTabs) {
    const tab = page.locator(`button:has-text("${tabText}"), a:has-text("${tabText}"), [role="tab"]:has-text("${tabText}")`).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(2000);
      console.log(`     clicked tab: ${tabText}`);
    }
  }

  capturedRequests.slice(priorFin).forEach(r => { r.page = 'financials-tabs'; });
  console.log(`     captured ${capturedRequests.length - priorFin} API calls`);

  // ── 4. Shareholding ──────────────────────────────────────────────────────────
  await visit('shareholding', `/company/${TEST_COMPANY}/shareholding/`);
  await scrollSlowly();

  // ── 5. Benchmarking ─────────────────────────────────────────────────────────
  await visit('benchmarking', `/company/${TEST_COMPANY}/benchmarking/`);

  // ── 6. Reports ──────────────────────────────────────────────────────────────
  await visit('reports', `/company/${TEST_COMPANY}/reports/`);

  // ── 7. Filter / screener ────────────────────────────────────────────────────
  console.log(`   → [filter/screener — interact]`);
  const priorFilter = capturedRequests.length;
  await page.goto(`${BASE_URL}/filter/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Try typing a filter query
  const filterInput = page.locator('input[placeholder*="filter" i], input[placeholder*="metric" i], input[placeholder*="search" i]').first();
  if (await filterInput.isVisible().catch(() => false)) {
    await filterInput.type('revenue', { delay: 80 });
    await page.waitForTimeout(2000);
  }
  await scrollSlowly();

  capturedRequests.slice(priorFilter).forEach(r => { r.page = 'filter-screener'; });
  console.log(`     captured ${capturedRequests.length - priorFilter} API calls`);

  // ── 8. Markets + Macro ───────────────────────────────────────────────────────
  await visit('markets', '/markets');
  await visit('macro', '/macro');

  await browser.close();

  // ── Step 3: Write results ───────────────────────────────────────────────────
  console.log('\n[3/3] Writing results...');

  const seen = new Set();
  const unique = capturedRequests.filter(r => {
    const key = `${r.method}:${r.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const byPage = {};
  unique.forEach(r => {
    const group = r.page || 'unknown';
    (byPage[group] ??= []).push({
      method: r.method,
      url: r.url,
      status: r.status,
      responseKeys: r.responseKeys || [],
      responseBodySample: r.responseBodySample || null,
      auth: {
        hasAuthHeader: !!r.headers?.authorization,
        hasCookie: !!r.headers?.cookie,
        csrfToken: r.headers?.['x-csrftoken'] || null,
      },
    });
  });

  const apiPaths = unique.map(r => {
    try {
      const u = new URL(r.url);
      return `${r.method} ${u.host}${u.pathname}`;
    } catch { return r.url; }
  });

  writeFileSync(OUTPUT_PATH, JSON.stringify({
    discoveredAt: new Date().toISOString(),
    totalRequests: unique.length,
    summary: apiPaths,
    byPage,
    allRequests: unique,
  }, null, 2));

  console.log(`\nDone! ${unique.length} unique API calls captured.`);
  console.log(`Results → output/discovered_endpoints.json`);
  console.log('\n── Discovered endpoints ──────────────────────────────────────');
  apiPaths.forEach(p => console.log('  ', p));
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
