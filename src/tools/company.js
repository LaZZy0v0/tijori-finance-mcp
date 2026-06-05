import { loadPage, closePage } from '../browser.js';
import { parseOverview } from '../parsers/overview.js';
import { get, set, TTL } from '../cache.js';

export async function getCompanyOverview(slug) {
  const cacheKey = `overview:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage(`/company/${slug}/`);
  try {
    const result = await parseOverview(page);
    set(cacheKey, result, TTL.FINANCIALS);
    return result;
  } finally {
    await closePage(page);
  }
}
