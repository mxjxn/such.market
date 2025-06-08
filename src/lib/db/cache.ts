import { Redis } from '@upstash/redis';
import type { Database } from '~/db/types/database.types';
import { APP_NAME } from '~/lib/constants';

// Types from database
type Collection = Database['public']['Tables']['collections']['Row'];
type NFT = Database['public']['Tables']['nfts']['Row'];
type CollectionTrait = Database['public']['Tables']['collection_traits']['Row'];

// Type for cached data
type CachedData<T> = {
  data: T;
  timestamp: number;
};

// Redis client initialization
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis ? new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
}) : null;

// In-memory fallback storage
const localStore = new Map<string, CachedData<unknown>>();

// Cache durations (in seconds)
const CACHE_DURATIONS = {
  COLLECTION: 3600, // 1 hour
  COLLECTION_NFTS: 1800, // 30 minutes
  COLLECTION_TRAITS: 3600, // 1 hour
  NFT_OWNER: 900, // 15 minutes
} as const;

// Cache key patterns
const CACHE_KEYS = {
  collection: (address: string) => `${APP_NAME}:collection:${address.toLowerCase()}`,
  collectionNFTs: (address: string, page: number, pageSize: number) => 
    `${APP_NAME}:collection:${address.toLowerCase()}:nfts:${page}:${pageSize}`,
  collectionTraits: (address: string) => 
    `${APP_NAME}:collection:${address.toLowerCase()}:traits`,
  nftOwner: (address: string, tokenId: string) => 
    `${APP_NAME}:nft:${address.toLowerCase()}:${tokenId}:owner`,
} as const;

// Helper function to get cached data
async function getCached<T>(key: string, ttl: number): Promise<T | null> {
  if (redis) {
    const cached = await redis.get<CachedData<T>>(key);
    if (cached && Date.now() - cached.timestamp < ttl * 1000) {
      return cached.data;
    }
    return null;
  }
  
  const cached = localStore.get(key) as CachedData<T> | undefined;
  if (cached && Date.now() - cached.timestamp < ttl * 1000) {
    return cached.data;
  }
  return null;
}

// Helper function to set cached data
async function setCached<T>(key: string, data: T, ttl: number): Promise<void> {
  const cacheData = { data, timestamp: Date.now() };
  
  if (redis) {
    await redis.set(key, cacheData, { ex: ttl });
  } else {
    localStore.set(key, cacheData);
  }
}

// Helper function to invalidate cache
async function invalidateCache(pattern: string): Promise<void> {
  if (redis) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } else {
    // For in-memory cache, we need to manually track keys
    for (const key of localStore.keys()) {
      if (key.startsWith(pattern)) {
        localStore.delete(key);
      }
    }
  }
}

// Collection cache functions
export async function getCachedCollection(address: string): Promise<Collection | null> {
  return getCached<Collection>(
    CACHE_KEYS.collection(address),
    CACHE_DURATIONS.COLLECTION
  );
}

export async function setCachedCollection(address: string, collection: Collection): Promise<void> {
  await setCached(
    CACHE_KEYS.collection(address),
    collection,
    CACHE_DURATIONS.COLLECTION
  );
}

// Collection NFTs cache functions
export async function getCachedCollectionNFTs(
  address: string,
  page: number,
  pageSize: number
): Promise<{ nfts: NFT[]; total: number } | null> {
  return getCached<{ nfts: NFT[]; total: number }>(
    CACHE_KEYS.collectionNFTs(address, page, pageSize),
    CACHE_DURATIONS.COLLECTION_NFTS
  );
}

export async function setCachedCollectionNFTs(
  address: string,
  page: number,
  pageSize: number,
  data: { nfts: NFT[]; total: number }
): Promise<void> {
  await setCached(
    CACHE_KEYS.collectionNFTs(address, page, pageSize),
    data,
    CACHE_DURATIONS.COLLECTION_NFTS
  );
}

// Collection traits cache functions
export async function getCachedCollectionTraits(
  address: string
): Promise<CollectionTrait[] | null> {
  return getCached<CollectionTrait[]>(
    CACHE_KEYS.collectionTraits(address),
    CACHE_DURATIONS.COLLECTION_TRAITS
  );
}

export async function setCachedCollectionTraits(
  address: string,
  traits: CollectionTrait[]
): Promise<void> {
  await setCached(
    CACHE_KEYS.collectionTraits(address),
    traits,
    CACHE_DURATIONS.COLLECTION_TRAITS
  );
}

// NFT owner cache functions
export async function getCachedNFTOwner(
  address: string,
  tokenId: string
): Promise<string | null> {
  return getCached<string>(
    CACHE_KEYS.nftOwner(address, tokenId),
    CACHE_DURATIONS.NFT_OWNER
  );
}

export async function setCachedNFTOwner(
  address: string,
  tokenId: string,
  owner: string
): Promise<void> {
  await setCached(
    CACHE_KEYS.nftOwner(address, tokenId),
    owner,
    CACHE_DURATIONS.NFT_OWNER
  );
}

// Cache invalidation functions
export async function invalidateCollectionCache(address: string): Promise<void> {
  const pattern = `${APP_NAME}:collection:${address.toLowerCase()}:*`;
  await invalidateCache(pattern);
}

export async function invalidateNFTCache(address: string, tokenId: string): Promise<void> {
  const pattern = `${APP_NAME}:nft:${address.toLowerCase()}:${tokenId}:*`;
  await invalidateCache(pattern);
}

// Cache status functions
export async function getCacheStatus(): Promise<{
  type: 'redis' | 'memory';
  keys: number;
  memoryUsage?: number;
}> {
  if (redis) {
    const keys = await redis.keys(`${APP_NAME}:*`);
    return {
      type: 'redis',
      keys: keys.length,
    };
  }
  
  return {
    type: 'memory',
    keys: localStore.size,
    memoryUsage: process.memoryUsage().heapUsed,
  };
} 