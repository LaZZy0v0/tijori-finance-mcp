import assert from 'node:assert/strict';
import { getOperationalMetrics, getFundFlow } from '../src/tools/metrics.js';
import { closeBrowser } from '../src/browser.js';

// Tata Steel: company_id=338, sector_id discovered from resolveCompanyIds
// Use a known working company_id. sector_id may be null if not intercepted — test with null handling.
const metrics = await getOperationalMetrics(338, 443);
assert.ok(metrics, 'metrics must not be null');
assert.ok(typeof metrics === 'object', 'metrics must be object');

const fundFlow = await getFundFlow(338, 5);
assert.ok(fundFlow, 'fundFlow must not be null');

console.log('metrics.test: PASS');
console.log('Metrics keys:', Object.keys(metrics));
console.log('FundFlow keys:', Object.keys(fundFlow));

await closeBrowser();
process.exit(0);
