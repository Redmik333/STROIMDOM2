// In-memory cache that persists across page navigations (single session)
const store = {};

export function getCached(key) {
  const entry = store[key];
  if (!entry) return null;
  return entry.data;
}

export function setCached(key, data) {
  store[key] = { data, ts: Date.now() };
}

// Returns cached data immediately and calls fetcher in background to refresh
// onData is called once with cached data (if any), then again with fresh data
export async function fetchWithCache(key, fetcher, onData) {
  const cached = getCached(key);
  if (cached) onData(cached, true); // instant render from cache
  const fresh = await fetcher();
  setCached(key, fresh);
  onData(fresh, false);
  return fresh;
}