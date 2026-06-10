import { loadPage, closePage } from '../browser.js';
import { parseFinancials } from '../parsers/financials.js';
import { get, set, TTL } from '../cache.js';

const VALID_TYPES = ['pl', 'bs', 'cf', 'ratios', 'quarterly'];

export async function getFinancials(slug, type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const cacheKey = `financials:${slug}:${type}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage(`/company/${slug}/financials/`, { waitFor: 'table.dataTable' });
  try {
    const result = await parseFinancials(page, type);
    set(cacheKey, result, TTL.FINANCIALS);
    return result;
  } finally {
    await closePage(page);
  }
}
