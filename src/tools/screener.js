import { browserFetch, loadPage, closePage } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

const METRIC_MAP = {
  roe:                    'ROE',
  roce:                   '3yr Avg ROCE',
  debt_to_equity:         'Debt to Equity Ratio',
  'debt to equity':       'Debt to Equity Ratio',
  operating_margin:       'Operating Profit Margin',
  'operating margin':     'Operating Profit Margin',
  opm:                    'Operating Profit Margin',
  revenue_growth:         '3yr Growth Net Sales',
  sales_growth:           '3yr Growth Net Sales',
  dividend_yield:         'Dividend Yield',
  pe:                     'PE Ratio',
  pb:                     'PB Ratio',
  market_cap:             'Market Capitalization',
  'market cap':           'Market Capitalization',
  pat:                    'PAT',
  eps:                    'EPS',
  net_sales:              'Net Sales',
  revenue:                'Net Sales',
  // Banking
  nim:                    'Net Interest Margin',
  'net interest margin':  'Net Interest Margin',
  casa:                   'CASA Ratio',
  gross_npa:              'Gross NPA',
  net_npa:                'Net NPA',
  crar:                   'Capital Adequacy Ratio',
  // Profitability
  npm:                    'Net Profit Margin',
  'net profit margin':    'Net Profit Margin',
  roa:                    'Return on Assets',
  roce_3yr:               '3yr Avg ROCE',
  // Value
  ev_ebitda:              'EV/EBITDA',
  'price to book':        'PB Ratio',
  // Growth
  pat_growth:             '3yr Growth PAT',
  'pat growth':           '3yr Growth PAT',
  earnings_growth:        '3yr Growth PAT',
  // Balance sheet
  current_ratio:          'Current Ratio',
  interest_coverage:      'Interest Coverage Ratio',
  // Cash flow
  fcf:                    'Free Cash Flow',
  'free cash flow':       'Free Cash Flow',
  cfo:                    'Cash Flow from Operations',
};

function buildQuery(filters) {
  const parts = [];
  for (const [key, condition] of Object.entries(filters)) {
    const metricName = METRIC_MAP[key.toLowerCase()] ?? key;
    if (condition.min !== undefined) parts.push(`( ${metricName} > ${condition.min} )`);
    if (condition.max !== undefined) parts.push(`( ${metricName} < ${condition.max} )`);
  }
  if (parts.length === 0) throw new Error('No valid filter conditions provided');
  return parts.join(' and ');
}

async function runQuery(query, { alternateQuery = '', queryId = 'null', isSme = false, whales = false, isChecked = false } = {}) {
  const params = new URLSearchParams({
    financial: query,
    aq: alternateQuery,
    is_checked: isChecked ? 'True' : 'False',
    whales: whales ? 'True' : 'False',
    is_sme: isSme ? 'True' : 'False',
    columns: '',
    source: 'Basic',
    query_id: queryId,
  });

  const url = `${BASE_URL}/api/filter_queries/advanced_search/?${params.toString()}`;
  const raw = await browserFetch(url);
  const results = Array.isArray(raw) ? raw : raw?.data ?? [];

  const cleanedResults = results.map(company => {
    const clean = {};
    for (const [k, v] of Object.entries(company)) {
      clean[k.replace(/<[^>]*>/g, '')] = v;
    }
    return clean;
  });

  return {
    total_results: raw?.total_results ?? cleanedResults.length,
    results: cleanedResults,
  };
}

export async function screenCompanies({ filters }) {
  if (!filters) throw new Error('filters is required. Pass a query string or object like { roe: { min: 15 } }');

  let query;
  if (typeof filters === 'string') {
    query = filters.trim();
    if (!query) throw new Error('filters query string must not be empty');
  } else if (typeof filters === 'object') {
    query = buildQuery(filters);
  } else {
    throw new Error('filters must be a query string or object');
  }

  const cacheKey = `screener:${query}`;
  const cached = get(cacheKey);
  if (cached) return cached;
  const result = await runQuery(query);
  set(cacheKey, result, TTL.METRICS);
  return result;
}

export async function listPopularScreens() {
  const cacheKey = 'popular_screens';
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage('/filter/popular-queries/');
  try {
    // Wait for popular screen links to render (JavaScript-driven)
    await page.waitForSelector('a[href*="query_id"]', { timeout: 8000 }).catch(() => {});

    const screens = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="query_id"]')).flatMap(a => {
        try {
          const url = new URL(a.href);
          const name = url.searchParams.get('queryName');
          const query = url.searchParams.get('fq');
          const query_id = url.searchParams.get('query_id');
          if (!name || !query) return [];
          return [{ name, query, query_id }];
        } catch { return []; }
      });
    });
    set(cacheKey, screens, TTL.SEARCH);
    return screens;
  } finally {
    await closePage(page);
  }
}
