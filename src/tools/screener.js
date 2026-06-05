import { browserFetch } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

/**
 * Map of common structured filter keys to Tijori Finance metric names.
 * Keys are lowercase shorthand; values are the exact metric name used in
 * Tijori's filter query language.
 */
const METRIC_MAP = {
  roe:                   'ROE',
  roce:                  '3yr Avg ROCE',
  'debt_to_equity':      'Debt to Equity Ratio',
  'debt to equity':      'Debt to Equity Ratio',
  'operating_margin':    'Operating Profit Margin',
  'operating margin':    'Operating Profit Margin',
  'revenue_growth':      '3yr Growth Net Sales',
  'sales_growth':        '3yr Growth Net Sales',
  'dividend_yield':      'Dividend yield',
  'pe':                  'PE Ratio',
  'pb':                  'PB Ratio',
  'market_cap':          'Market Cap',
  'pat':                 'PAT',
  'eps':                 'EPS',
  'net_sales':           'Net Sales',
  'revenue':             'Net Sales',
};

/**
 * Build a Tijori Finance query string from a structured filters object.
 *
 * Each key is a metric name (or shorthand from METRIC_MAP).
 * Each value is an object with optional `min` and/or `max` fields.
 *
 * Example:
 *   buildQuery({ roe: { min: 15 } })
 *   => "( ROE > 15 )"
 *
 *   buildQuery({ roe: { min: 10 }, debt_to_equity: { max: 0.5 } })
 *   => "( ROE > 10 ) and ( Debt to Equity Ratio < 0.5 )"
 */
function buildQuery(filters) {
  const parts = [];
  for (const [key, condition] of Object.entries(filters)) {
    const metricName = METRIC_MAP[key.toLowerCase()] ?? key;
    if (condition.min !== undefined) {
      parts.push(`( ${metricName} > ${condition.min} )`);
    }
    if (condition.max !== undefined) {
      parts.push(`( ${metricName} < ${condition.max} )`);
    }
  }
  if (parts.length === 0) {
    throw new Error('No valid filter conditions provided');
  }
  return parts.join(' and ');
}

/**
 * Screen companies using Tijori Finance's advanced filter endpoint.
 *
 * Accepts either:
 *   1. A raw query string (Tijori filter expression):
 *        screenCompanies('( ROE > 15 )')
 *        screenCompanies('( ROE > 15 ) and ( Debt to Equity Ratio < 0.5 )')
 *
 *   2. A structured filters object with min/max conditions:
 *        screenCompanies({ roe: { min: 15 } })
 *        screenCompanies({ roe: { min: 10 }, debt_to_equity: { max: 0.5 } })
 *
 * Common metric shorthand keys for structured form:
 *   roe, roce, debt_to_equity, operating_margin, revenue_growth,
 *   dividend_yield, pe, pb, market_cap, pat, eps, revenue
 *
 * For arbitrary metrics use the exact Tijori metric name as key.
 *
 * Endpoint: GET /api/filter_queries/advanced_search/
 *
 * Response: { total_results: number, results: Company[] }
 * Each Company: { name, slug, scripcode, "nse symbol", segment, ...metric columns }
 */
export async function screenCompanies(filtersOrQuery) {
  if (!filtersOrQuery) {
    throw new Error(
      'Argument required. Pass a query string like "( ROE > 15 )" or ' +
      'a filters object like { roe: { min: 15 } }'
    );
  }

  let query;
  if (typeof filtersOrQuery === 'string') {
    query = filtersOrQuery.trim();
    if (!query) throw new Error('Query string must not be empty');
  } else if (typeof filtersOrQuery === 'object') {
    query = buildQuery(filtersOrQuery);
  } else {
    throw new Error('Argument must be a query string or a filters object');
  }

  const cacheKey = `screener:${query}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    financial: query,
    is_checked: 'False',
    whales: 'False',
    is_sme: 'False',
    columns: '',
    source: 'Basic',
    query_id: 'null',
  });

  const url = `${BASE_URL}/api/filter_queries/advanced_search/?${params.toString()}`;
  const raw = await browserFetch(url);

  // Normalise: API returns { data: [...], total_results: N, ... }
  const results = Array.isArray(raw) ? raw : raw?.data ?? [];

  // Strip HTML tags from column keys
  // e.g. "<span>latest</span>ROE<span>%</span>" -> "latestROE%"
  const cleanedResults = results.map(company => {
    const clean = {};
    for (const [k, v] of Object.entries(company)) {
      const cleanKey = k.replace(/<[^>]*>/g, '');
      clean[cleanKey] = v;
    }
    return clean;
  });

  const response = {
    total_results: raw?.total_results ?? cleanedResults.length,
    results: cleanedResults,
  };

  set(cacheKey, response, TTL.METRICS);
  return response;
}
