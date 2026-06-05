import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import all tools
import { searchCompany } from './tools/search.js';
import { getCompanyOverview } from './tools/company.js';
import { getFinancials } from './tools/financials.js';
import { getShareholding } from './tools/shareholding.js';
import { getOperationalMetrics, getFundFlow } from './tools/metrics.js';
import { getRawMaterials, getMacroIndicators, getMarkets } from './tools/market.js';
import { screenCompanies } from './tools/screener.js';
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
    description: 'Search Tijori Finance for companies by name. Returns name, slug, company_id. Run this first to get the slug needed by other tools.',
    inputSchema: { query: z.string().min(1) },
  },
  wrap(({ query }) => searchCompany(query))
);

// 2. resolve_company_ids
server.registerTool(
  'resolve_company_ids',
  {
    description: 'Resolve a company slug to its numeric company_id and sector_id. Required before calling get_operational_metrics.',
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
    description: 'Get operational KPIs and sector peers. Run resolve_company_ids first to get company_id and sector_id.',
    inputSchema: {
      company_id: z.number().int().positive(),
      sector_id: z.number().int().positive(),
    },
  },
  wrap(({ company_id, sector_id }) => getOperationalMetrics(company_id, sector_id))
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
    description: 'Get index performance: headline indices (Nifty), niche TJI indices, or conglomerate indices.',
    inputSchema: { tab: z.enum(['headline', 'niche', 'conglomerates']) },
  },
  wrap(({ tab }) => getMarkets(tab))
);

// 11. screen_companies
server.registerTool(
  'screen_companies',
  {
    description: "Screen companies by financial metrics. Pass a filter object like {roe: {min: 15}} or a natural language query string like '( ROE > 15 ) and ( Debt to Equity Ratio < 0.5 )'.",
    inputSchema: {
      filters: z.union([
        z.string(),
        z.record(z.object({ min: z.number().optional(), max: z.number().optional() })),
      ]),
    },
  },
  wrap(({ filters }) => screenCompanies(filters))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
  process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
}

main().catch(err => { console.error('[tijori-mcp] Fatal:', err.message); process.exit(1); });
