// This file is deprecated - use the new unified Redis configuration from ~/lib/redis.ts
// Keeping this file for backward compatibility but it now re-exports from the new system

export { 
  redis, 
  isRedisConfigured, 
  CACHE_KEYS, 
  REDIS_CONFIG,
  getCachedData as getCachedNFTs,
  setCachedData as setCachedNFTs,
  invalidateCache
} from './redis';

// Legacy cache key for backward compatibility
export function getCollectionCacheKey(contractAddress: string): string {
  return `such-market:collections:${contractAddress.toLowerCase()}:metadata`;
} 