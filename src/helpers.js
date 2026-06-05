import { withPage } from './browser.js';
import { get, set, TTL } from './cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

export async function resolveCompanyIds(slug) {
  const cacheKey = `resolve:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    let sectorId = null;

    // Capture sector_id from the op-metrics AJAX URL that fires on page load
    page.on('request', req => {
      const match = req.url().match(/\/op-metrics\/(\d+)\//);
      if (match) sectorId = parseInt(match[1], 10);
    });

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

    // Wait for AJAX calls to fire (op-metrics is deferred)
    await page.waitForTimeout(3000);

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

    // Extract symbol and name while we're here
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
