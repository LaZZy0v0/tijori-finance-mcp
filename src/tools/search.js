import { browserFetch } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

/**
 * Extract company_id from a Tijori company page HTML.
 * The page embeds: <script id="companyId" type="application/json">338</script>
 */
async function fetchCompanyId(slug) {
  const cacheKey = `cid:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  try {
    const html = await browserFetch(`${BASE_URL}/company/${slug}/`);
    if (typeof html === 'string') {
      const m = html.match(/<script[^>]*id="companyId"[^>]*>(\d+)<\/script>/);
      if (m) {
        const id = parseInt(m[1], 10);
        set(cacheKey, id, TTL.FINANCIALS);
        return id;
      }
    }
  } catch (_) {
    // ignore errors for individual slugs — return NaN
  }
  return NaN;
}

export async function searchCompany(query) {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  // Real autocomplete endpoint discovered via network interception
  const url = `${BASE_URL}/api/v1/ind/company_search/?q=${encodeURIComponent(query)}`;
  const raw = await browserFetch(url);

  // Response shape: [{ name, slug, type }]
  // type is "companies", "sector", or "InActive"
  const items = (Array.isArray(raw) ? raw : [])
    .filter(item => item.type === 'companies' && item.slug);

  // Fetch company_id for each slug in parallel
  const company_ids = await Promise.all(items.map(item => fetchCompanyId(item.slug)));

  const results = items
    .map((item, i) => ({
      name: item.name ?? '',
      company_id: company_ids[i],
      slug: item.slug ?? '',
      sector: '',
      symbol: '',
    }))
    .filter(r => r.name && r.slug && !isNaN(r.company_id));

  set(cacheKey, results, TTL.SEARCH);
  return results;
}
