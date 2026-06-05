import { browserFetch } from '../browser.js';
import { get, set, TTL } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';

export async function getOperationalMetrics(companyId, sectorId) {
  const cacheKey = `op_metrics:${companyId}:${sectorId}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/api/v1/ind/company_op_metrics/${companyId}/${sectorId}/`;
  const raw = await browserFetch(url);

  const result = {
    company_id: companyId,
    sector_id: sectorId,
    peers: Array.isArray(raw?.peers) ? raw.peers : [],
    metrics: raw?.data ?? raw ?? {},
  };

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

  // The API returns all year periods in one call; we filter to the requested period
  const url = `${BASE_URL}/api/v1/ind/fund_flow_analysis_data/${companyId}/`;
  const raw = await browserFetch(url);

  // raw.data is an array of { name: 'sources'|'uses', data: { '1yr': [...], '3yr': [...], ... } }
  const yearKey = `${years}yr`;
  let result;
  if (Array.isArray(raw?.data)) {
    result = {
      company_id: companyId,
      years,
      year_key: yearKey,
      sources: raw.data.find(d => d.name === 'sources')?.data?.[yearKey] ?? [],
      uses: raw.data.find(d => d.name === 'uses')?.data?.[yearKey] ?? [],
      all_data: raw.data,
    };
  } else {
    result = { company_id: companyId, years, raw };
  }

  set(cacheKey, result, TTL.METRICS);
  return result;
}
