import { browserFetch, loadPage, closePage } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

// Results are unpaginated — a loose query returns 1000+ rows. Cap what goes
// back over MCP; total_results still reports the full match count.
const DEFAULT_LIMIT = 50;

// Shorthand aliases for the object form of `filters`. The canonical names come
// from /api/filter_queries/filter_field_search/ — any exact field name works
// directly in a query string, so this map only needs the common abbreviations.
const METRIC_MAP = {
  roe:                    'ROE',
  roce:                   'ROCE',
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
  cfo:                    'Cash from Operating Activity',
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

// The site templates write query strings into hrefs raw (spaces, newlines, %
// signs unencoded), so decodeURIComponent can throw on values like "ROCE > 20%".
function safeDecode(s) {
  try { return decodeURIComponent(s); }
  catch { return s.replace(/\+/g, ' '); }
}

function parseRunHref(href) {
  const qs = href.split('?')[1] ?? '';
  const params = {};
  for (const pair of qs.split('&')) {
    const i = pair.indexOf('=');
    if (i === -1) continue;
    // Collapse the raw newlines/double spaces the template leaves in fq —
    // the API treats whitespace runs and single spaces identically.
    params[safeDecode(pair.slice(0, i)).trim()] = safeDecode(pair.slice(i + 1)).replace(/\s+/g, ' ').trim();
  }
  return params;
}

function stripSpans(results) {
  return results.map(company => {
    const clean = {};
    for (const [k, v] of Object.entries(company)) {
      clean[k.replace(/<[^>]*>/g, '')] = v;
    }
    return clean;
  });
}

// Fetches ALL matching rows (the API is unpaginated). Callers cache this full
// set and page through it with paginate() — offset requests never re-hit Tijori.
async function runScreenerApi(endpoint, params) {
  const search = new URLSearchParams({
    financial: '',
    alternate: '',
    aq: '',
    is_checked: 'False',
    whales: 'False',
    is_sme: 'False',
    columns: '',
    query_id: 'null',
    ...params,
  });

  const raw = await browserFetch(`${BASE_URL}${endpoint}?${search.toString()}`);
  if (typeof raw === 'string') {
    throw new Error(`Screener API returned an error page. Query may be malformed: ${search.get('financial') || search.get('alternate')}`);
  }
  if (raw?.error) throw new Error(`Screener API error: ${raw.error}`);

  const results = stripSpans(Array.isArray(raw) ? raw : raw?.data ?? []);
  return { total_results: raw?.total_results ?? results.length, results };
}

function paginate({ total_results, results }, offset, limit) {
  const page = results.slice(offset, offset + limit);
  const shownThrough = offset + page.length;
  return {
    total_results,
    returned: page.length,
    ...(offset > 0 ? { offset } : {}),
    ...(shownThrough < total_results
      ? { note: `Showing rows ${offset + 1}–${shownThrough} of ${total_results}. Pass offset: ${shownThrough} for the next batch.` }
      : {}),
    results: page,
  };
}

// ---------------------------------------------------------------------------
// Popular screens
// ---------------------------------------------------------------------------

async function fetchPopularScreens() {
  const cacheKey = 'popular_screens';
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage('/filter/popular-queries/', { waitFor: '.query_card' });
  try {
    // Cards render in document order under category headers; walk both so each
    // card inherits the heading above it.
    const cards = await page.evaluate(() => {
      const found = [];
      let category = null;
      document.querySelectorAll('.popular_query_title, .query_card').forEach(el => {
        if (el.classList.contains('popular_query_title')) {
          category = el.textContent.trim();
          return;
        }
        const name = el.querySelector('.query_title')?.textContent.trim();
        const description = el.querySelector('.query_desc')?.textContent.replace(/\s+/g, ' ').trim();
        const href = el.querySelector('a[href*="query_id"]')?.getAttribute('href');
        if (name && href) found.push({ category, name, description, href });
      });
      return found;
    });

    const screens = cards.map(({ category, name, description, href }) => {
      const p = parseRunHref(href);
      return {
        category,
        name,
        description,
        query_id: p.query_id ?? null,
        query: p.fq || null,
        alternate_query: p.aq || null,
        whales: p.whales === 'true',
      };
    });

    if (screens.length === 0) throw new Error('No popular screens found — page structure may have changed');
    set(cacheKey, screens, TTL.FINANCIALS);
    return screens;
  } finally {
    await closePage(page);
  }
}

export async function listPopularScreens() {
  return fetchPopularScreens();
}

async function runPreset(preset, offset, limit) {
  const screens = await fetchPopularScreens();
  const needle = preset.toLowerCase().trim();
  const screen =
    screens.find(s => s.name.toLowerCase() === needle) ??
    screens.find(s => s.name.toLowerCase().includes(needle));
  if (!screen) {
    throw new Error(`No popular screen matching "${preset}". Available: ${screens.map(s => s.name).join(', ')}`);
  }

  const cacheKey = `screener:preset:${screen.name}`;
  let full = get(cacheKey);
  if (!full) {
    // Presets must run through the popular-query endpoint: it resolves the saved
    // query_id server-side, which is what makes alternate (market-share style)
    // queries work — advanced_search silently ignores them.
    full = await runScreenerApi('/api/filter_queries/popular-query/results/', {
      financial: screen.query ?? '',
      alternate: screen.alternate_query ?? '',
      whales: screen.whales ? 'True' : 'False',
      source: 'Popular',
      query_id: screen.query_id ?? 'null',
    });
    set(cacheKey, full, TTL.METRICS);
  }

  return { screen: screen.name, query: screen.query ?? screen.alternate_query, ...paginate(full, offset, limit) };
}

// ---------------------------------------------------------------------------
// Ad-hoc screening
// ---------------------------------------------------------------------------

export async function screenCompanies({ filters, alternate, preset, latest_results_only = false, superstar_investors = false, sme = false, offset = 0, limit = DEFAULT_LIMIT }) {
  if (preset) {
    return runPreset(preset, offset, limit);
  }

  if (!filters && !alternate?.trim() && !superstar_investors && !sme) {
    throw new Error("Pass 'filters' (a query string like '( ROE > 15 ) and ( Market Capitalization > 500 )' or an object like { roe: { min: 15 } }), 'alternate' (a business-data query like 'market share > 50' or 'revenue from Defence > 50'), or 'preset' (a popular screen name from list_popular_screens).");
  }

  let query = '';
  if (filters !== undefined) {
    if (typeof filters === 'string') {
      query = filters.trim();
      if (!query && !alternate?.trim()) throw new Error('filters query string must not be empty');
    } else if (typeof filters === 'object') {
      query = buildQuery(filters);
    } else {
      throw new Error('filters must be a query string or object');
    }
  }
  const altQuery = alternate?.trim() ?? '';

  const cacheKey = `screener:${query}|${altQuery}|${latest_results_only}|${superstar_investors}|${sme}`;
  let full = get(cacheKey);
  if (!full) {
    full = await runScreenerApi('/api/filter_queries/advanced_search/', {
      financial: query,
      alternate: altQuery,
      is_checked: latest_results_only ? 'True' : 'False',
      whales: superstar_investors ? 'True' : 'False',
      is_sme: sme ? 'True' : 'False',
      source: 'Basic',
    });
    set(cacheKey, full, TTL.METRICS);
  }

  const result = paginate(full, offset, limit);
  if (query) result.query = query;
  if (altQuery) result.alternate_query = altQuery;
  return result;
}

// ---------------------------------------------------------------------------
// Field catalog search
// ---------------------------------------------------------------------------

const FIELD_RESULT_CAP = 60;

export async function searchScreenerFields({ query, type }) {
  if (!query?.trim()) throw new Error('query is required, e.g. "roce", "promoter holding", "npa"');

  // Fetch the full ~3,300-field catalog once and search locally. The server's
  // own q= search only matches Financials and 404s on anything else.
  const cacheKey = 'screener_field_catalog';
  let data = get(cacheKey);
  if (!data) {
    const raw = await browserFetch(`${BASE_URL}/api/filter_queries/filter_field_search/?q=&query_type=financials`);
    data = raw?.data ?? [];
    if (data.length === 0) throw new Error('Field catalog came back empty — API may have changed');
    set(cacheKey, data, TTL.FINANCIALS);
  }

  const wanted = type?.toLowerCase();
  const terms = query.toLowerCase().trim().split(/\s+/);
  const matches = data
    .filter(f => (!wanted || f.type.toLowerCase() === wanted) &&
                 terms.every(t => f.value.toLowerCase().includes(t)))
    .map(f => ({ name: f.value, type: f.type, ...(f.unit ? { unit: f.unit } : {}) }));

  return {
    total_matches: matches.length,
    ...(matches.length > FIELD_RESULT_CAP ? { note: `Showing first ${FIELD_RESULT_CAP} of ${matches.length}. Refine the query.` } : {}),
    fields: matches.slice(0, FIELD_RESULT_CAP),
  };
}
