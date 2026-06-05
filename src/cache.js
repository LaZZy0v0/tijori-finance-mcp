const store = new Map();

export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
}

export function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export const TTL = {
  FINANCIALS:    6 * 60 * 60 * 1000,
  SHAREHOLDING:  6 * 60 * 60 * 1000,
  MACRO:         1 * 60 * 60 * 1000,
  RAW_MATERIALS: 1 * 60 * 60 * 1000,
  MARKETS:       15 * 60 * 1000,
  SEARCH:         5 * 60 * 1000,
  METRICS:       30 * 60 * 1000,
};
