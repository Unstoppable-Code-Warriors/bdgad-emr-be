export interface AuthCacheConfig {
  ttl: number; // Time to live in milliseconds
  maxItems: number; // Maximum number of items in cache
  enableCache: boolean; // Enable/disable caching
}

export const DEFAULT_AUTH_CACHE_CONFIG: AuthCacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxItems: 1000,
  enableCache: true,
};
