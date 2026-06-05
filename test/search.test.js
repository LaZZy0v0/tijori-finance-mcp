import assert from 'node:assert/strict';
import { searchCompany } from '../src/tools/search.js';
import { closeBrowser } from '../src/browser.js';

const results = await searchCompany('Tata Steel');

assert.ok(Array.isArray(results), 'result must be an array');
assert.ok(results.length > 0, 'must return at least one result');

const first = results[0];
assert.ok(typeof first.name === 'string', 'name must be string');
assert.ok(typeof first.slug === 'string', 'slug must be string');
assert.ok(typeof first.company_id === 'number', 'company_id must be number');

console.log('search.test: PASS');
console.log('First result:', JSON.stringify(first, null, 2));

await closeBrowser();
process.exit(0);
