import { Redis } from '@upstash/redis';
import { APP_NAME } from './constants';

// Debug: Log the actual APP_NAME being used
console.log('🔧 [Redis] APP_NAME from constants:', APP_NAME);
console.log('🔧 [Redis] NEXT_PUBLIC_FRAME_NAME env var:', process.env.NEXT_PUBLIC_FRAME_NAME);

// Ensure we use the correct app name
const CACHE_APP_NAME = process.env.NEXT_PUBLIC_FRAME_NAME || APP_NAME || 'such-market';
console.log('🔧 [Redis] Final cache app name:', CACHE_APP_NAME);

// Unified Redis configuration
export const REDIS_CONFIG = {
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  ttl: {
    hot: 300,      // 5 minutes
    warm: 1800,    // 30 minutes
    cold: 86400,   // 24 hours
  }
} as const;

// Check if Redis is properly configured
export const isRedisConfigured = !!(REDIS_CONFIG.url && REDIS_CONFIG.token);

// Initialize Redis client
export const redis = isRedisConfigured ? new Redis({
  url: REDIS_CONFIG.url!,
  token: REDIS_CONFIG.token!,
}) : null;

// Cache key patterns with hierarchical structure
export const CACHE_KEYS = {
  // Collection metadata (L1 - Hot)
  collectionMetadata: (address: string) => 
    `${CACHE_APP_NAME}:collections:${address.toLowerCase()}:metadata`,
  
  // Collection NFTs (L2 - Warm)
  collectionNFTs: (address: string, page: number, pageSize: number) => 
    `${CACHE_APP_NAME}:collections:${address.toLowerCase()}:nfts:page:${page}:size:${pageSize}`,
  
  // Collection traits (L2 - Warm)
  collectionTraits: (address: string) => 
    `${CACHE_APP_NAME}:collections:${address.toLowerCase()}:traits`,
  
  // User collections (L3 - Cold)
  userCollections: (fid: number) => 
    `${CACHE_APP_NAME}:users:${fid}:collections`,
  
  // NFT ownership (L1 - Hot)
  nftOwnership: (address: string, tokenId: string) => 
    `${CACHE_APP_NAME}:ownership:${address.toLowerCase()}:${tokenId}`,
  
  // User profile (L1 - Hot)
  userProfile: (fid: number) => 
    `${CACHE_APP_NAME}:users:${fid}:profile`,
  
  // Wallet NFT contracts (L3 - Cold)
  walletContracts: (walletAddress: string) => 
    `${CACHE_APP_NAME}:wallets:${walletAddress.toLowerCase()}:contracts`,
  
  // Collection stats (L2 - Warm)
  collectionStats: (address: string) => 
    `${CACHE_APP_NAME}:collections:${address.toLowerCase()}:stats`,
  
  // User prioritized collections (L1 - Hot, 5 min TTL)
  userPrioritizedCollections: (fid: number) => 
    `${CACHE_APP_NAME}:users:${fid}:prioritized_collections`,
  
  // Collection engagement scores (L2 - Warm, 30 min TTL)
  collectionEngagement: (collectionId: string) => 
    `${CACHE_APP_NAME}:collections:engagement:${collectionId}`,
  
  // User all collections (L3 - Cold, 24 hour TTL)
  userAllCollections: (fid: number) => 
    `${CACHE_APP_NAME}:users:${fid}:all_collections`,
  
  // Collection view counters (real-time, synced to DB periodically)
  collectionViews24h: (collectionId: string) => 
    `${CACHE_APP_NAME}:collections:${collectionId}:views:24h`,
  collectionViews7d: (collectionId: string) => 
    `${CACHE_APP_NAME}:collections:${collectionId}:views:7d`,
  collectionViews30d: (collectionId: string) => 
    `${CACHE_APP_NAME}:collections:${collectionId}:views:30d`,
} as const;

// Cache data types
export interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Helper function to get cached data with TTL checking
export async function getCachedData<T>(key: string): Promise<T | null> {
  if (!redis) {
    console.log('🔄 [Cache] Redis not configured, using in-memory fallback');
    return null;
  }

  try {
    const cached = await redis.get<CachedData<T>>(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl * 1000) {
      console.log('📦 [Cache] Redis hit:', {
        key,
        age: Math.round((Date.now() - cached.timestamp) / 1000),
        ttl: cached.ttl,
      });
      return cached.data;
    }
    
    console.log('🔄 [Cache] Redis miss:', {
      key,
      hasData: !!cached,
      age: cached ? Math.round((Date.now() - cached.timestamp) / 1000) : null,
    });
    return null;
  } catch (error) {
    console.error('❌ [Cache] Redis get error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
    });
    return null;
  }
}

// Helper function to set cached data
export async function setCachedData<T>(key: string, data: T, ttl: number): Promise<void> {
  if (!redis) {
    console.log('⚠️ [Cache] Redis not configured, skipping cache set');
    return;
  }

  try {
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    
    await redis.setex(key, ttl, cacheData);
    console.log('💾 [Cache] Redis set:', { key, ttl });
  } catch (error) {
    console.error('❌ [Cache] Redis set error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
    });
  }
}

// Helper function to invalidate cache by pattern
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) {
    console.log('⚠️ [Cache] Redis not configured, skipping cache invalidation');
    return;
  }

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('🗑️ [Cache] Invalidated keys:', { pattern, count: keys.length });
    }
  } catch (error) {
    console.error('❌ [Cache] Redis invalidation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pattern,
    });
  }
}

// Cache warming function
export async function warmCache(contractAddress: string): Promise<void> {
  if (!redis) {
    console.log('⚠️ [Cache] Redis not configured, skipping cache warming');
    return;
  }

  console.log('🔥 [Cache] Warming cache for:', contractAddress);
  
  // This would be implemented to pre-populate cache with collection data
  // Implementation depends on your data fetching logic
}

// Cache status function
export async function getCacheStatus(): Promise<{
  type: 'redis' | 'memory' | 'none';
  keys: number;
  memoryUsage?: number;
}> {
  if (!redis) {
    return {
      type: 'none',
      keys: 0,
    };
  }

  try {
    const keys = await redis.keys(`${CACHE_APP_NAME}:*`);
    return {
      type: 'redis',
      keys: keys.length,
    };
  } catch (error) {
    console.error('❌ [Cache] Error getting cache status:', error);
    return {
      type: 'none',
      keys: 0,
    };
  }
}

// Log Redis configuration status
console.log('🔧 [Redis] Configuration status:', {
  configured: isRedisConfigured,
  url: REDIS_CONFIG.url ? '✅ Set' : '❌ Not set',
  token: REDIS_CONFIG.token ? '✅ Set' : '❌ Not set',
  appName: CACHE_APP_NAME,
}); 