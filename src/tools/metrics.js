import { withPage, browserFetch } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

async function clickOperationalTab(page) {
  // Playwright real click: scrolls into view, fires full mouse event chain
  const clicked = await page.locator('a[href="#operationalmetrics"]')
    .click({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!clicked) {
    // Fallback: trigger hashchange directly — fires Tijori's lazy-load listener
    await page.evaluate(() => { window.location.hash = 'operationalmetrics'; });
  }
}

async function waitForMetrics(page, timeout = 12000) {
  await page.waitForSelector('li[metricid]', { timeout }).catch(() => {});
  return page.$$eval('li[metricid]', els => els.length);
}

export async function getOperationalMetrics(slug) {
  const cacheKey = `op_metrics:${slug}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const result = await withPage(async (page) => {
    const response = await page.goto(`${BASE_URL}/company/${slug}/`, {
      waitUntil: 'load',
      timeout: 30000,
    });

    if (response?.status() === 404) throw Object.assign(new Error(`Company not found: ${slug}`), { code: 'NOT_FOUND' });
    if (response?.status() === 403) throw Object.assign(new Error('Session expired. Run: node discover.js --reauth'), { code: 'SESSION_EXPIRED' });

    // First click attempt
    await clickOperationalTab(page);
    let count = await waitForMetrics(page, 12000);

    // Retry once if the first click didn't land
    if (count === 0) {
      await page.waitForTimeout(1000);
      await clickOperationalTab(page);
      await waitForMetrics(page, 8000);
    }

    const { companyId, topMetrics } = await page.evaluate(() => {
      const allMetrics = Array.from(document.querySelectorAll('li[metricid]'))
        .map(li => ({
          metric_id: parseInt(li.getAttribute('metricid'), 10),
          name: li.getAttribute('title'),
          unit: li.getAttribute('unit')?.trim() ?? null,
          indent: li.getAttribute('indent') ?? '0',
        }))
        .filter(m => m.metric_id && m.name);

      // Extract company_id from the onclick URL — guaranteed to match these metrics
      const onclickAttr = document.querySelector('li[metricid][onclick]')?.getAttribute('onclick') ?? '';
      const idMatch = onclickAttr.match(/company_op_metrics\/(\d+)\//);
      const companyId = idMatch ? parseInt(idMatch[1], 10) : null;

      // Prefer top-level (indent=0); fall back to all if none found
      const topLevel = allMetrics.filter(m => m.indent === '0');
      return { companyId, topMetrics: topLevel.length > 0 ? topLevel : allMetrics };
    });

    if (!companyId) throw new Error('Could not extract company_id from page');
    if (topMetrics.length === 0) throw new Error('No operational metrics found — tab may not have loaded');

    // Use page.request (Playwright's HTTP client) — more reliable than fetch inside evaluate
    const metricData = await Promise.all(topMetrics.map(async (metric) => {
      try {
        const url = `${BASE_URL}/api/v1/ind/company_op_metrics/${companyId}/${metric.metric_id}/`;
        const res = await page.request.get(url);
        if (!res.ok()) return { name: metric.name, unit: metric.unit, latest_value: null, error: `HTTP ${res.status()}` };
        const data = await res.json();
        const series = Array.isArray(data.data) ? data.data : [];
        const latest = series.at(-1);
        const history = series.map(([ts, val]) => ({
          date: new Date(ts).toISOString().slice(0, 7),
          value: val,
        }));
        return {
          name: metric.name,
          unit: metric.unit,
          latest_value: latest?.[1] ?? null,
          latest_date: latest ? new Date(latest[0]).toISOString().slice(0, 7) : null,
          history,
        };
      } catch (e) {
        return { name: metric.name, unit: metric.unit, latest_value: null, error: e.message };
      }
    }));

    return { slug, company_id: companyId, metrics: metricData };
  });

  set(cacheKey, result, TTL.METRICS);
  return result;
}

export async function getFundFlow(companyId, years) {
  const validYears = [1, 3, 5, 7, 10];
  if (!validYears.includes(years)) {
    throw new Error(`Invalid years "${years}". Must be one of: ${validYears.join(', ')}`);
  }

  const cacheKey = `fund_flow:${companyId}:${years}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/api/v1/ind/fund_flow_analysis_data/${companyId}/`;
  const raw = await browserFetch(url);

  const yearKey = `${years}yr`;
  let result;
  if (Array.isArray(raw?.data)) {
    result = {
      company_id: companyId,
      years,
      sources: raw.data.find(d => d.name === 'sources')?.data?.[yearKey] ?? [],
      uses: raw.data.find(d => d.name === 'uses')?.data?.[yearKey] ?? [],
    };
  } else {
    result = { company_id: companyId, years, raw };
  }

  set(cacheKey, result, TTL.METRICS);
  return result;
}
