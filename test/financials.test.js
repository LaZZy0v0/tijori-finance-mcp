import assert from 'node:assert/strict';
import { getFinancials } from '../src/tools/financials.js';
import { closeBrowser } from '../src/browser.js';

const result = await getFinancials('tata-steel-limited', 'pl');

assert.ok(result, 'result must not be null');
assert.ok(typeof result === 'object', 'result must be an object');
assert.ok(
  Array.isArray(result.rows) || Array.isArray(result.data) || Object.keys(result).length > 0,
  'result must contain financial data'
);

console.log('financials.test (pl): PASS');
console.log('Keys:', Object.keys(result));
if (result.rows) console.log('Row count:', result.rows.length);
if (result.headers) console.log('Headers:', result.headers);

await closeBrowser();
process.exit(0);
