import { Redis } from "@upstash/redis";
import { Nft } from "alchemy-sdk";

// Use Redis if KV env vars are present, otherwise use in-memory
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis ? new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
}) : null;

// In-memory fallback storage
const localStore = new Map<string, { nfts: Nft[], timestamp: number }>();

// Cache duration - 24 hours in milliseconds
const CACHE_DURATION = 24 * 60 * 60 * 1000;

function getCollectionCacheKey(contractAddress: string): string {
  return `nft:collection:${contractAddress.toLowerCase()}`;
}

export async function getCachedNFTs(contractAddress: string): Promise<Nft[] | null> {
  const key = getCollectionCacheKey(contractAddress);
  
  if (redis) {
    const cached = await redis.get<{ nfts: Nft[], timestamp: number }>(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.nfts;
    }
    return null;
  }
  
  const cached = localStore.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.nfts;
  }
  return null;
}

export async function setCachedNFTs(contractAddress: string, nfts: Nft[]): Promise<void> {
  const key = getCollectionCacheKey(contractAddress);
  const data = { nfts, timestamp: Date.now() };
  
  if (redis) {
    await redis.set(key, data);
  } else {
    localStore.set(key, data);
  }
}

export async function invalidateCache(contractAddress: string): Promise<void> {
  const key = getCollectionCacheKey(contractAddress);
  
  if (redis) {
    await redis.del(key);
  } else {
    localStore.delete(key);
  }
}

// Helper to check if cache is stale
export function isCacheStale(timestamp: number): boolean {
  return Date.now() - timestamp >= CACHE_DURATION;
} 