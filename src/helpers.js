import { withPage } from './browser.js';
import { get, set, TTL } from './cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

export async function resolveCompanyIds(slug) {
  const cacheKey = `resolve:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
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

    return page.evaluate(() => {
      const html = document.documentElement.innerHTML;

      // company_id: from inline script JSON blob
      const companyIdMatch = html.match(/"company_id"\s*:\s*(\d+)/);
      const companyId = companyIdMatch ? parseInt(companyIdMatch[1], 10) : null;

      // name and symbol: from inline script JSON blob
      const metaMatch = html.match(/"company"\s*:\s*"([^"]+)"\s*,\s*"company_id"\s*:\s*\d+\s*,\s*"symbol"\s*:\s*"([^"]+)"/);
      const name   = metaMatch ? metaMatch[1] : null;
      const symbol = metaMatch ? metaMatch[2] : null;

      return { company_id: companyId, name, symbol };
    });
  });

  const final = { slug, ...result };
  set(cacheKey, final, TTL.METRICS);
  return final;
}
