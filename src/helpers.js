import { loadPage, closePage } from './browser.js';
import { get, set, TTL } from './cache.js';

export async function resolveCompanyIds(slug) {
  const cacheKey = `resolve:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  // The ids live in a server-rendered inline <script> JSON blob, so the page DOM
  // (domcontentloaded) is enough — no client-rendered anchor to wait for.
  const page = await loadPage(`/company/${slug}/`);
  let result;
  try {
    result = await page.evaluate(() => {
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
  } finally {
    await closePage(page);
  }

  const final = { slug, ...result };
  set(cacheKey, final, TTL.METRICS);
  return final;
}
