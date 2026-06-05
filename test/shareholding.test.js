import assert from 'node:assert/strict';
import { getShareholding } from '../src/tools/shareholding.js';
import { closeBrowser } from '../src/browser.js';

const result = await getShareholding('tata-steel-limited');

assert.ok(result, 'result must not be null');
assert.ok(Array.isArray(result.quarters), 'result.quarters must be an array');
assert.ok(result.quarters.length > 0, 'must have at least one quarter');

const q = result.quarters[0];
assert.ok(typeof q.period === 'string', 'period must be string');

console.log('shareholding.test: PASS');
console.log('Quarter count:', result.quarters.length);
console.log('Sample quarter:', JSON.stringify(result.quarters[0], null, 2));

await closeBrowser();
process.exit(0);
