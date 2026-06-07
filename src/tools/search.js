import { browserFetch } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

export async function searchCompany(query) {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/api/v1/ind/company_search/?q=${encodeURIComponent(query)}`;
  const raw = await browserFetch(url);

  // Response shape: [{ name, slug, type }]
  // type is "companies", "sector", or "InActive"
  const results = (Array.isArray(raw) ? raw : [])
    .filter(item => item.type === 'companies' && item.slug && item.name)
    .map(item => ({ name: item.name, slug: item.slug }));

  set(cacheKey, results, TTL.SEARCH);
  return results;
}
