import { loadPage, closePage, browserFetch } from '../browser.js';
import { parseRawMaterials, parseMacroIndicators, parseMarkets } from '../parsers/market.js';
import { get, set, TTL } from '../cache.js';

const VALID_RAW = ['chemicals', 'spreads', 'metals'];
const VALID_MACRO = ['industry', 'demand', 'gdp'];
const VALID_MARKETS = ['headline', 'niche', 'conglomerates'];

export async function getRawMaterials(tab) {
  if (!VALID_RAW.includes(tab)) throw new Error(`Invalid tab "${tab}". Must be: ${VALID_RAW.join(', ')}`);
  const cacheKey = `raw_materials:${tab}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage('/in/raw-materials', { waitFor: 'table.dataTable' });
  try {
    const result = await parseRawMaterials(page, tab);
    set(cacheKey, result, TTL.RAW_MATERIALS);
    return result;
  } finally {
    await closePage(page);
  }
}

export async function getMacroIndicators(tab) {
  if (!VALID_MACRO.includes(tab)) throw new Error(`Invalid tab "${tab}". Must be: ${VALID_MACRO.join(', ')}`);
  const cacheKey = `macro:${tab}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage('/in/macro', { waitFor: 'table.dataTable' });
  try {
    const result = await parseMacroIndicators(page, tab);
    set(cacheKey, result, TTL.MACRO);
    return result;
  } finally {
    await closePage(page);
  }
}

export async function getMarkets(tab) {
  if (!VALID_MARKETS.includes(tab)) throw new Error(`Invalid tab "${tab}". Must be: ${VALID_MARKETS.join(', ')}`);
  const cacheKey = `markets:${tab}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage('/in/markets', { waitFor: 'table.dataTable' });
  try {
    const result = await parseMarkets(page, tab);
    set(cacheKey, result, TTL.MARKETS);
    return result;
  } finally {
    await closePage(page);
  }
}

export async function getConglomerateConstituents(tjiid) {
  const cacheKey = `conglomerate_constituents:${tjiid}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const url = `https://www.tijorifinance.com/api/v1/groups/price/${tjiid}/`;
  const raw = await browserFetch(url);

  if (!Array.isArray(raw?.data ?? raw)) {
    throw new Error(`Unexpected response from Tijori for tjiid=${tjiid}`);
  }

  const companies = (raw?.data ?? raw).map(item => ({
    name: item.name,
    slug: item.slug,
    returns: {
      '1D': item.data?.[0] ?? null,
      '1W': item.data?.[1] ?? null,
      '1M': item.data?.[2] ?? null,
      '3M': item.data?.[3] ?? null,
      '6M': item.data?.[4] ?? null,
      '1Y': item.data?.[5] ?? null,
      '2Y': item.data?.[6] ?? null,
      '3Y': item.data?.[7] ?? null,
      '5Y': item.data?.[8] ?? null,
      '10Y': item.data?.[9] ?? null,
    },
  }));

  const result = { tjiid, total: companies.length, companies };
  set(cacheKey, result, TTL.MARKETS);
  return result;
}

export async function getNicheConstituents(tjiid) {
  const cacheKey = `niche_constituents:${tjiid}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const url = `https://www.tijorifinance.com/api/v1/niche/price/${tjiid}/`;
  const raw = await browserFetch(url);

  if (!Array.isArray(raw?.data ?? raw)) {
    throw new Error(`Unexpected response from Tijori for tjiid=${tjiid}`);
  }

  const companies = (raw?.data ?? raw).map(item => ({
    name: item.name,
    slug: item.slug,
    weight_pct: item.weight ?? null,
    eq_weight_pct: item.eq_weight ?? null,
    returns: {
      '1D': item.data?.[0] ?? null,
      '1W': item.data?.[1] ?? null,
      '1M': item.data?.[2] ?? null,
      '3M': item.data?.[3] ?? null,
      '6M': item.data?.[4] ?? null,
      '1Y': item.data?.[5] ?? null,
      '2Y': item.data?.[6] ?? null,
      '3Y': item.data?.[7] ?? null,
      '5Y': item.data?.[8] ?? null,
      '10Y': item.data?.[9] ?? null,
    },
  }));

  const result = { tjiid, total: companies.length, companies };
  set(cacheKey, result, TTL.MARKETS);
  return result;
}
