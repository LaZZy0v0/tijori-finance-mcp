import assert from 'node:assert/strict';
import { get, set, TTL } from '../src/cache.js';

// miss before set
assert.strictEqual(get('a'), null, 'should miss before set');

// hit after set
set('a', { value: 42 }, 1000);
assert.deepStrictEqual(get('a'), { value: 42 }, 'should hit after set');

// miss after expiry
set('b', 'x', 1); // 1ms TTL
await new Promise(r => setTimeout(r, 5));
assert.strictEqual(get('b'), null, 'should miss after TTL expires');

// TTL constants are positive numbers
assert.ok(TTL.FINANCIALS > 0);
assert.ok(TTL.MARKETS > 0);
assert.ok(TTL.MARKETS < TTL.FINANCIALS, 'markets TTL should be shorter than financials');

console.log('cache.test: PASS');
