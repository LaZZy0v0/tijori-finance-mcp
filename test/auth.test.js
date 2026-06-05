import assert from 'node:assert/strict';
import { getAuthHeaders } from '../src/auth.js';

// This test requires output/session.json to exist (run discover.js first)
const headers = getAuthHeaders();
assert.ok(headers.Cookie.includes('sessionid='), 'Cookie header must contain sessionid');
assert.ok(typeof headers['X-CSRFToken'] === 'string', 'X-CSRFToken must be a string');
assert.ok(headers['User-Agent'].includes('Mozilla'), 'User-Agent must be set');
console.log('auth.test: PASS');
