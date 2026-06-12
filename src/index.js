import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import all tools
import { searchCompany } from './tools/search.js';
import { getCompanyOverview, getKnowledgeBase, fetchDocument, getRevenueMix, getMarketShare } from './tools/company.js';
import { getFinancials } from './tools/financials.js';
import { getShareholding } from './tools/shareholding.js';
import { getOperationalMetrics, getFundFlow } from './tools/metrics.js';
import { getRawMaterials, getMacroIndicators, getMarkets, getNicheConstituents, getConglomerateConstituents } from './tools/market.js';
import { screenCompanies, listPopularScreens, searchScreenerFields } from './tools/screener.js';
import { resolveCompanyIds } from './helpers.js';
import { closeBrowser } from './browser.js';

const server = new McpServer({ name: 'tijori-finance', version: '0.1.0' });

function wrap(fn) {
  return async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.code ?? 'ERROR', message: err.message }) }],
        isError: true,
      };
    }
  };
}

// 1. search_company
server.registerTool(
  'search_company',
  {
    description: 'Search Tijori Finance for companies by name. Returns name and slug. Use the slug with all other tools.',
    inputSchema: { query: z.string().min(1) },
  },
  wrap(({ query }) => searchCompany(query))
);

// 2. resolve_company_ids
server.registerTool(
  'resolve_company_ids',
  {
    description: 'Resolve a company slug to its numeric company_id. Required before calling get_fund_flow.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => resolveCompanyIds(slug))
);

// 3. get_company_overview
server.registerTool(
  'get_company_overview',
  {
    description: 'Get company overview: key financial ratios, forensics score, market cap, PE, ROE, ROCE.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getCompanyOverview(slug))
);

// 4. get_financials
server.registerTool(
  'get_financials',
  {
    description: 'Get financial statements. type: pl=Profit&Loss, bs=Balance Sheet, cf=Cash Flow, ratios=Financial Ratios, quarterly=Quarterly Results.',
    inputSchema: {
      slug: z.string(),
      type: z.enum(['pl', 'bs', 'cf', 'ratios', 'quarterly']),
    },
  },
  wrap(({ slug, type }) => getFinancials(slug, type))
);

// 5. get_shareholding
server.registerTool(
  'get_shareholding',
  {
    description: 'Get 10-quarter shareholding breakdown: promoter %, FII %, DII %, public %.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getShareholding(slug))
);

// 6. get_operational_metrics
server.registerTool(
  'get_operational_metrics',
  {
    description: 'Get all operational KPIs for a company with latest values and recent trend. Pass the company slug.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getOperationalMetrics(slug))
);

// 7. get_fund_flow
server.registerTool(
  'get_fund_flow',
  {
    description: 'Get capital allocation (fund flow) breakdown over 1, 3, 5, 7, or 10 years. Run resolve_company_ids first.',
    inputSchema: {
      company_id: z.number().int().positive(),
      years: z.union([
        z.literal(1),
        z.literal(3),
        z.literal(5),
        z.literal(7),
        z.literal(10),
      ]),
    },
  },
  wrap(({ company_id, years }) => getFundFlow(company_id, years))
);

// 8. get_raw_materials
server.registerTool(
  'get_raw_materials',
  {
    description: 'Get commodity price performance for Chemicals, Spreads, or Metals.',
    inputSchema: { tab: z.enum(['chemicals', 'spreads', 'metals']) },
  },
  wrap(({ tab }) => getRawMaterials(tab))
);

// 9. get_macro_indicators
server.registerTool(
  'get_macro_indicators',
  {
    description: 'Get India macro indicators: industry credit/IIP, demand (GST/auto), or GDP & trade.',
    inputSchema: { tab: z.enum(['industry', 'demand', 'gdp']) },
  },
  wrap(({ tab }) => getMacroIndicators(tab))
);

// 10. get_markets
server.registerTool(
  'get_markets',
  {
    description: 'Get index performance: headline (Nifty/Sensex/Nifty Bank etc.), niche (TJI sector indices with 1D–5Y price returns — each row includes tjiid for get_sector_constituents), or conglomerates (9 Indian business groups — each row includes tjiid for get_conglomerate_constituents).',
    inputSchema: {
      tab: z.enum(['headline', 'niche', 'conglomerates']),
    },
  },
  wrap(({ tab }) => getMarkets(tab))
);

// 11. get_sector_constituents
server.registerTool(
  'get_sector_constituents',
  {
    description: 'Get all constituent companies of a TJI niche sector index. Pass the tjiid from get_markets({ tab: "niche" }). Returns each company\'s slug (usable with other tools), market-cap weight %, equal weight %, and price returns for 1D/1W/1M/3M/6M/1Y/2Y/3Y/5Y/10Y.',
    inputSchema: {
      tjiid: z.number().int().positive(),
    },
  },
  wrap(({ tjiid }) => getNicheConstituents(tjiid))
);

// 12. get_conglomerate_constituents
server.registerTool(
  'get_conglomerate_constituents',
  {
    description: 'Get all constituent companies of a conglomerate group. Pass the tjiid from get_markets({ tab: "conglomerates" }). Returns each company\'s slug (usable with other tools) and price returns for 1D/1W/1M/3M/6M/1Y/2Y/3Y/5Y/10Y. The conglomerates tab itself shows ROE by year; this tool gives the underlying price performance per stock.',
    inputSchema: {
      tjiid: z.number().int().positive(),
    },
  },
  wrap(({ tjiid }) => getConglomerateConstituents(tjiid))
);

// 13. get_knowledge_base
server.registerTool(
  'get_knowledge_base',
  {
    description: 'Get all investor documents for a company: annual reports, earnings releases, investor presentations, conference call transcripts, and curated research links. Returns URLs grouped by document type.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getKnowledgeBase(slug))
);

// 14. fetch_document
server.registerTool(
  'fetch_document',
  {
    description: 'Fetch and extract text from a Tijori Finance document (PDF). Pass a URL returned by get_knowledge_base. Uses the authenticated browser session to bypass CDN access controls. Returns the full text content and page count.',
    inputSchema: { url: z.string().url() },
  },
  wrap(({ url }) => fetchDocument(url))
);

// 15. get_revenue_mix
server.registerTool(
  'get_revenue_mix',
  {
    description: 'Get revenue/segment mix breakdowns for a company. Returns latest % breakdown and full historical trend per segment.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getRevenueMix(slug))
);

// 15. get_market_share
server.registerTool(
  'get_market_share',
  {
    description: 'Get all market share metrics for a company (e.g. Bank Advances, Credit Cards, Housing Loans). Returns latest % value and as-of date for each metric.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => getMarketShare(slug))
);

// 16. list_popular_screens
server.registerTool(
  'list_popular_screens',
  {
    description: 'List all pre-built popular stock screens on Tijori Finance, grouped by category, with each screen\'s name, description, and underlying query. Run one with screen_companies { preset: "<name>" }.',
    inputSchema: {},
  },
  wrap(() => listPopularScreens())
);

// 17. screen_companies
server.registerTool(
  'screen_companies',
  {
    description: "Screen companies by financial metrics. Pass EITHER 'preset' (a popular screen name from list_popular_screens, e.g. 'Cash Flow Machines') OR 'filters'. 'filters' accepts a query string like '( ROE > 15 ) and ( Market Capitalization > 500 )' or a shorthand object like {roe:{min:15}, debt_to_equity:{max:0.5}}. Query strings support any field name from search_screener_fields, % values ('ROCE > 20%'), field-vs-field comparisons ('Net Sales > 3Yrs ago Net Sales'), and arithmetic ('capex/Net Block > 0.5'). 'limit' caps returned rows (default 50); total_results always reports the full match count.",
    inputSchema: {
      filters: z.union([
        z.string(),
        z.record(z.object({ min: z.number().optional(), max: z.number().optional() })),
      ]).optional(),
      preset: z.string().optional(),
      limit: z.number().int().positive().max(500).optional(),
    },
  },
  wrap((args) => screenCompanies(args))
);

// 18. search_screener_fields
server.registerTool(
  'search_screener_fields',
  {
    description: "Search Tijori's screener field catalog (~1,500 financial metrics with time-period variants like '3yr Avg ROCE', '5yr Growth Net Sales', '10Yrs ago PAT', plus product segments and regions). Use to find the exact field name before building a screen_companies query. Example: query 'promoter holding' or 'npa'.",
    inputSchema: {
      query: z.string().min(1),
      type: z.enum(['Financials', 'Products', 'Regions']).optional(),
    },
  },
  wrap((args) => searchScreenerFields(args))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
  process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
}

main().catch(err => { console.error('[tijori-mcp] Fatal:', err.message); process.exit(1); });
