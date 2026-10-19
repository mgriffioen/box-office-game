// Tiny in-memory cache that also shares in-flight requests for the same key.
export function createCache({ ttlMs = 12 * 60 * 60 * 1000, maxEntries = 500 } = {}) {
  const store = new Map();

  return async function cached(key, load) {
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const value = Promise.resolve().then(load);
    store.set(key, { value, expires: Date.now() + ttlMs });
    if (store.size > maxEntries) store.delete(store.keys().next().value);
    // Don't remember failures; let the next request try again.
    value.catch(() => store.get(key)?.value === value && store.delete(key));
    return value;
  };
}
