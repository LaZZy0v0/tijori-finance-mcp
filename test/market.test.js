import assert from 'node:assert/strict';
import { getRawMaterials, getMacroIndicators, getMarkets } from '../src/tools/market.js';
import { closeBrowser } from '../src/browser.js';

const raw = await getRawMaterials('chemicals');
assert.ok(Array.isArray(raw.rows), 'raw materials rows must be array');
assert.ok(raw.rows.length > 0, 'must have rows');
console.log('getRawMaterials (chemicals): PASS — ' + raw.rows.length + ' rows');

const macro = await getMacroIndicators('industry');
assert.ok(Array.isArray(macro.rows), 'macro rows must be array');
assert.ok(macro.rows.length > 0);
console.log('getMacroIndicators (industry): PASS — ' + macro.rows.length + ' rows');

const markets = await getMarkets('headline');
assert.ok(Array.isArray(markets.rows), 'markets rows must be array');
assert.ok(markets.rows.length > 0);
console.log('getMarkets (headline): PASS — ' + markets.rows.length + ' rows');

await closeBrowser();
process.exit(0);
