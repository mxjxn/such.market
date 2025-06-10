import type { Database } from '@/db/types/database.types';
import { 
  redis, 
  isRedisConfigured, 
  CACHE_KEYS, 
  REDIS_CONFIG,
  getCachedData,
  setCachedData,
  invalidateCache
} from '../redis';

// Types from database
type Collection = Database['public']['Tables']['collections']['Row'];
type NFT = Database['public']['Tables']['nfts']['Row'];

// In-memory fallback storage (only used if Redis is not configured)
const localStore = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

// Collection cache functions
export async function getCachedCollection(address: string): Promise<Collection | null> {
  return getCachedData<Collection>(CACHE_KEYS.collectionMetadata(address));
}

export async function setCachedCollection(address: string, collection: Collection): Promise<void> {
  await setCachedData(CACHE_KEYS.collectionMetadata(address), collection, REDIS_CONFIG.ttl.hot);
}

// Collection NFTs cache functions
export async function getCachedCollectionNFTs(
  address: string,
  page: number,
  pageSize: number
): Promise<{ nfts: NFT[]; total: number } | null> {
  return getCachedData<{ nfts: NFT[]; total: number }>(
    CACHE_KEYS.collectionNFTs(address, page, pageSize)
  );
}

export async function setCachedCollectionNFTs(
  address: string,
  page: number,
  pageSize: number,
  data: { nfts: NFT[]; total: number }
): Promise<void> {
  await setCachedData(
    CACHE_KEYS.collectionNFTs(address, page, pageSize),
    data,
    REDIS_CONFIG.ttl.warm
  );
}

// Collection traits cache functions
export async function getCachedCollectionTraits(address: string): Promise<unknown | null> {
  return getCachedData(CACHE_KEYS.collectionTraits(address));
}

export async function setCachedCollectionTraits(address: string, traits: unknown): Promise<void> {
  await setCachedData(CACHE_KEYS.collectionTraits(address), traits, REDIS_CONFIG.ttl.warm);
}

// NFT owner cache functions
export async function getCachedNFTOwner(
  address: string,
  tokenId: string
): Promise<string | null> {
  return getCachedData<string>(CACHE_KEYS.nftOwnership(address, tokenId));
}

export async function setCachedNFTOwner(
  address: string,
  tokenId: string,
  owner: string
): Promise<void> {
  await setCachedData(CACHE_KEYS.nftOwnership(address, tokenId), owner, REDIS_CONFIG.ttl.hot);
}

// User collections cache functions
export async function getCachedUserCollections(fid: number): Promise<unknown | null> {
  return getCachedData(CACHE_KEYS.userCollections(fid));
}

export async function setCachedUserCollections(fid: number, collections: unknown): Promise<void> {
  await setCachedData(CACHE_KEYS.userCollections(fid), collections, REDIS_CONFIG.ttl.cold);
}

// Wallet contracts cache functions
export async function getCachedWalletContracts(walletAddress: string): Promise<unknown | null> {
  return getCachedData(CACHE_KEYS.walletContracts(walletAddress));
}

export async function setCachedWalletContracts(walletAddress: string, contracts: unknown): Promise<void> {
  await setCachedData(CACHE_KEYS.walletContracts(walletAddress), contracts, REDIS_CONFIG.ttl.cold);
}

// Cache invalidation functions
export async function invalidateCollectionCache(address: string): Promise<void> {
  await invalidateCache(`${CACHE_KEYS.collectionMetadata(address).split(':metadata')[0]}:*`);
}

export async function invalidateUserCache(fid: number): Promise<void> {
  await invalidateCache(`${CACHE_KEYS.userCollections(fid).split(':collections')[0]}:*`);
}

export async function invalidateWalletCache(walletAddress: string): Promise<void> {
  await invalidateCache(`${CACHE_KEYS.walletContracts(walletAddress).split(':contracts')[0]}:*`);
}

// Cache status functions
export async function getCacheStatus(): Promise<{
  type: 'redis' | 'memory';
  keys: number;
  memoryUsage?: number;
}> {
  if (isRedisConfigured && redis) {
    try {
      const keys = await redis.keys('*');
      return {
        type: 'redis',
        keys: keys.length,
      };
    } catch (error) {
      console.error('❌ Error getting Redis cache status:', error);
    }
  }
  
  return {
    type: 'memory',
    keys: localStore.size,
    memoryUsage: process.memoryUsage().heapUsed,
  };
} 