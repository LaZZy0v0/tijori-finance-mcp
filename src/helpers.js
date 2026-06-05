import { withPage } from './browser.js';
import { get, set, TTL } from './cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

export async function resolveCompanyIds(slug) {
  const cacheKey = `resolve:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    // Set up waitForRequest BEFORE navigation — this actively waits for the
    // op-metrics request rather than passively listening (which can miss it).
    // Real URL: /api/v1/ind/company_op_metrics/{companyId}/{sectorId}/
    const sectorIdPromise = page.waitForRequest(
      req => /\/company_op_metrics\/\d+\/\d+\//.test(req.url()),
      { timeout: 12000 }
    ).then(req => {
      const match = req.url().match(/\/company_op_metrics\/\d+\/(\d+)\//);
      return match ? parseInt(match[1], 10) : null;
    }).catch(() => null); // returns null if request never fires within 12s

    const response = await page.goto(`${BASE_URL}/company/${slug}/`, {
      waitUntil: 'load',
      timeout: 30000,
    });

    if (response?.status() === 404) {
      throw Object.assign(new Error(`Company not found: ${slug}`), { code: 'NOT_FOUND' });
    }
    if (response?.status() === 403) {
      throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });
    }

    // Scroll down to trigger any intersection-observer lazy loads
    await page.evaluate(async () => {
      for (let y = 0; y < 2000; y += 400) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 200));
      }
    }).catch(() => {});

    // Wait for the op-metrics request (promise started before navigation)
    const sectorId = await sectorIdPromise;

    // Extract company_id from inline script JSON blob
    const companyId = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'));
      for (const s of scripts) {
        const m = s.textContent.match(/"company_id"\s*:\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
      return null;
    });

    if (!companyId) throw new Error(`Could not extract company_id for slug: ${slug}`);

    // Extract symbol and name
    const meta = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'));
      for (const s of scripts) {
        const m = s.textContent.match(/\{"company"\s*:\s*"([^"]+)"\s*,\s*"company_id"\s*:\s*\d+\s*,\s*"symbol"\s*:\s*"([^"]+)"/);
        if (m) return { name: m[1], symbol: m[2] };
      }
      return { name: null, symbol: null };
    });

    return { slug, company_id: companyId, sector_id: sectorId, ...meta };
  });

  set(cacheKey, result, TTL.METRICS);
  return result;
}
