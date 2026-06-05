import { loadPage, closePage } from '../browser.js';
import { parseShareholding } from '../parsers/shareholding.js';
import { get, set, TTL } from '../cache.js';

export async function getShareholding(slug) {
  const cacheKey = `shareholding:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage(`/company/${slug}/shareholding/`);
  try {
    const result = await parseShareholding(page);
    set(cacheKey, result, TTL.SHAREHOLDING);
    return result;
  } finally {
    await closePage(page);
  }
}
