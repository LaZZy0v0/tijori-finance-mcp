import { loadPage, closePage } from '../browser.js';
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

  const page = await loadPage('/in/raw-materials');
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

  const page = await loadPage('/in/macro');
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

  const page = await loadPage('/in/markets');
  try {
    const result = await parseMarkets(page, tab);
    set(cacheKey, result, TTL.MARKETS);
    return result;
  } finally {
    await closePage(page);
  }
}
