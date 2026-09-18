let catalogCache = {
  server1: { data: null, lastFetch: 0 },
  server2: { data: null, lastFetch: 0 },
  server3: { data: null, lastFetch: 0 }
};

let catalogVersion = 1;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

module.exports = {
  catalogCache,
  getCatalogVersion: () => catalogVersion,
  incrementCatalogVersion: () => { catalogVersion++; },
  CACHE_TTL
};
