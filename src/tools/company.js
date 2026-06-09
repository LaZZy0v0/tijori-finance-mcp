import { loadPage, closePage, withPage } from '../browser.js';
import { parseOverview } from '../parsers/overview.js';
import { get, set, TTL } from '../cache.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const BASE_URL = 'https://www.tijorifinance.com';

export async function getCompanyOverview(slug) {
  const cacheKey = `overview:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const page = await loadPage(`/company/${slug}/`);
  try {
    const result = await parseOverview(page);
    set(cacheKey, result, TTL.FINANCIALS);
    return result;
  } finally {
    await closePage(page);
  }
}

export async function getKnowledgeBase(slug) {
  const cacheKey = `knowledge_base:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    const response = await page.goto(`${BASE_URL}/company/${slug}/`, { waitUntil: 'load', timeout: 30000 });
    if (response?.status() === 404) throw Object.assign(new Error(`Company not found: ${slug}`), { code: 'NOT_FOUND' });
    if (response?.status() === 403) throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });

    const clicked = await page.locator('a[href="#knowledgebase"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) await page.evaluate(() => { window.location.hash = 'knowledgebase'; });

    await page.waitForSelector('#knowledgebase a[href]', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const section = document.querySelector('#knowledgebase');
      if (!section) return null;

      const categories = {
        annual_reports: [],
        earnings_releases: [],
        investor_presentations: [],
        conference_calls: [],
      };

      for (const a of section.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? '';
        if (!href || !href.includes('files.tijorifinance.com')) continue;

        // Derive period label from filename (e.g. AR-25 → FY25, CC-Jan26 → Jan 2026)
        const file = href.split('/').pop()?.replace('.pdf', '') ?? '';
        let period = file;
        const annualMatch = file.match(/^AR-(\d{2})$/);
        const quarterlyMatch = file.match(/^(?:CC|ER|IP)-([A-Za-z]{3})(\d{2})$/);
        if (annualMatch) period = `FY${annualMatch[1]}`;
        else if (quarterlyMatch) period = `${quarterlyMatch[1]} 20${quarterlyMatch[2]}`;

        const entry = { period, url: href };

        if (href.includes('Annual%20Report')) {
          categories.annual_reports.push(entry);
        } else if (href.includes('Earnings%20Release')) {
          categories.earnings_releases.push(entry);
        } else if (href.includes('Investor%20Presentation')) {
          categories.investor_presentations.push(entry);
        } else if (href.includes('Conference%20Call')) {
          categories.conference_calls.push(entry);
        }
      }

      return categories;
    });
  });

  if (!result) throw new Error('Knowledge Base section did not load');
  const final = { slug, ...result };
  set(cacheKey, final, TTL.FINANCIALS);
  return final;
}

export async function fetchDocument(url) {
  if (!url.includes('files.tijorifinance.com')) {
    throw new Error('Only files.tijorifinance.com URLs are supported');
  }

  const cacheKey = `doc:${url}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  // Use Playwright's API request context — sends browser cookies but runs at Node.js
  // level, bypassing CORS restrictions that block JS fetch() from the page context
  const buffer = await withPage(async (page) => {
    const response = await page.context().request.get(url, {
      headers: {
        'Referer': 'https://www.tijorifinance.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok()) {
      const status = response.status();
      if (status === 403) throw new Error('Access denied — session may have expired. Run: npm run reauth');
      if (status === 404) throw new Error('Document not found at this URL');
      throw new Error(`HTTP ${status} from CDN`);
    }
    return response.body();
  });

  const data = await pdfParse(buffer);
  const result = {
    url,
    pages: data.numpages,
    text: data.text.trim(),
  };

  set(cacheKey, result, TTL.FINANCIALS);
  return result;
}

export async function getRevenueMix(slug) {
  const cacheKey = `revenue_mix:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    const response = await page.goto(`${BASE_URL}/company/${slug}/`, { waitUntil: 'load', timeout: 30000 });
    if (response?.status() === 404) throw Object.assign(new Error(`Company not found: ${slug}`), { code: 'NOT_FOUND' });
    if (response?.status() === 403) throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });

    const clicked = await page.locator('a[href="#revenuemix"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) await page.evaluate(() => { window.location.hash = 'revenuemix'; });

    await page.waitForSelector('.rmix_pie_chart[chart-id]', { timeout: 10000 }).catch(() => {});

    const charts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.rmix_graph_block')).map(block => {
        const pieEl = block.querySelector('.rmix_pie_chart[chart-id]');
        if (!pieEl) return null;
        let latest = [];
        try { latest = JSON.parse(pieEl.getAttribute('chart-data') ?? '[]'); } catch {}
        return {
          chartId: pieEl.getAttribute('chart-id'),
          title: block.querySelector('h4')?.textContent?.trim() ?? null,
          latest_breakdown: latest.map(([name, pct]) => ({ name, pct })),
        };
      }).filter(Boolean)
    );

    if (charts.length === 0) throw new Error('Revenue Mix section did not load');

    const chartsWithHistory = await Promise.all(charts.map(async (chart) => {
      try {
        const res = await page.request.get(`${BASE_URL}/api/rmix/historic/graph/${chart.chartId}`);
        if (!res.ok()) return { title: chart.title, chart_id: parseInt(chart.chartId, 10), latest_breakdown: chart.latest_breakdown, error: `HTTP ${res.status()}` };
        const data = await res.json();
        const segments = (data.context ?? []).map(seg => {
          let history = [];
          try {
            history = JSON.parse(seg.graphdata).map(([ts, val]) => ({
              date: new Date(ts).toISOString().slice(0, 7),
              value: val,
            }));
          } catch {}
          return { name: seg.fieldname, history };
        });
        return { title: chart.title, chart_id: parseInt(chart.chartId, 10), latest_breakdown: chart.latest_breakdown, segments };
      } catch (e) {
        return { title: chart.title, chart_id: parseInt(chart.chartId, 10), latest_breakdown: chart.latest_breakdown, error: e.message };
      }
    }));

    return { slug, charts: chartsWithHistory };
  });

  set(cacheKey, result, TTL.FINANCIALS);
  return result;
}

export async function getMarketShare(slug) {
  const cacheKey = `market_share:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    const response = await page.goto(`${BASE_URL}/company/${slug}/`, { waitUntil: 'load', timeout: 30000 });
    if (response?.status() === 404) throw Object.assign(new Error(`Company not found: ${slug}`), { code: 'NOT_FOUND' });
    if (response?.status() === 403) throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });

    const clicked = await page.locator('a[href="#marketshare"]').click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) await page.evaluate(() => { window.location.hash = 'marketshare'; });

    await page.waitForSelector('.market_share_card[data-title]', { timeout: 10000 }).catch(() => {});

    const metrics = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.market_share_card[data-title]')).map(card => {
        const text = card.textContent ?? '';
        const valueMatch = text.match(/([\d.]+)\s*%/);
        const dateMatch = text.match(/\(as of ([^)]+)\)/);
        return {
          metric: card.getAttribute('data-title'),
          value: valueMatch ? parseFloat(valueMatch[1]) : null,
          as_of: dateMatch ? dateMatch[1].trim() : null,
        };
      })
    );

    if (metrics.length === 0) throw new Error('Market Share section did not load');
    return { slug, metrics };
  });

  set(cacheKey, result, TTL.FINANCIALS);
  return result;
}
