import { FrameNotificationDetails } from "@farcaster/frame-sdk";
import { Redis } from "@upstash/redis";
import { APP_NAME } from "./constants";

// In-memory fallback storage
const localStore = new Map<string, FrameNotificationDetails>();
const localCollections = new Map<string, string>();

// Use Redis if KV env vars are present, otherwise use in-memory
console.log('🔧 Checking Redis configuration...');
console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');

const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const redis = useRedis ? new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
}) : null;

console.log('Redis initialization:', useRedis ? '✅ Using Redis' : '❌ Using in-memory storage');

// Keys for different types of data
const COLLECTIONS_KEY = `${APP_NAME}:collections`;

function getUserNotificationDetailsKey(fid: number): string {
  return `${APP_NAME}:user:${fid}`;
}

export async function getUserNotificationDetails(
  fid: number
): Promise<FrameNotificationDetails | null> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    return await redis.get<FrameNotificationDetails>(key);
  }
  return localStore.get(key) || null;
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: FrameNotificationDetails
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    await redis.set(key, notificationDetails);
  } else {
    localStore.set(key, notificationDetails);
  }
}

export async function deleteUserNotificationDetails(
  fid: number
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  if (redis) {
    await redis.del(key);
  } else {
    localStore.delete(key);
  }
}

// Collection name functions
export async function addCollectionName(name: string, address: string): Promise<void> {
  console.log('📝 [KV Store] Adding collection:', { name, address });
  
  if (redis) {
    console.log('🔑 [KV Store] Using Redis for storage');
    const collections = await redis.get<Record<string, string>>(COLLECTIONS_KEY) || {};
    console.log('📚 [KV Store] Current collections in Redis:', { 
      count: Object.keys(collections).length,
      collections: Object.entries(collections)
    });
    
    collections[name] = address;
    await redis.set(COLLECTIONS_KEY, collections);
    
    // Verify the write
    const verifyCollections = await redis.get<Record<string, string>>(COLLECTIONS_KEY);
    console.log('✅ [KV Store] Verification after write:', {
      success: verifyCollections?.[name] === address,
      collections: verifyCollections
    });
  } else {
    console.log('⚠️ [KV Store] Using in-memory storage (Redis not configured)');
    localCollections.set(name, address);
    console.log('📚 [KV Store] Current collections in memory:', {
      count: localCollections.size,
      collections: Array.from(localCollections.entries())
    });
  }
}

export async function getCollectionNames(): Promise<Record<string, string>> {
  console.log('🔍 [KV Store] Fetching collections...');
  
  if (redis) {
    console.log('🔑 [KV Store] Using Redis for retrieval');
    const collections = await redis.get<Record<string, string>>(COLLECTIONS_KEY) || {};
    console.log('📚 [KV Store] Retrieved from Redis:', { 
      count: Object.keys(collections).length,
      collections: Object.entries(collections),
      raw: collections // Log the raw object to see its structure
    });
    return collections;
  } else {
    console.log('⚠️ [KV Store] Using in-memory storage (Redis not configured)');
    const collections = Object.fromEntries(localCollections);
    console.log('📚 [KV Store] Retrieved from memory:', {
      count: Object.keys(collections).length,
      collections: Object.entries(localCollections),
      raw: collections
    });
    return collections;
  }
}

export async function getCollectionSuggestions(prefix: string): Promise<Array<{ name: string; address: string }>> {
  if (!redis) return [];
  
  // Get all collection names
  const collections = await redis.hgetall<Record<string, string>>(COLLECTIONS_KEY);
  if (!collections) return [];

  // Filter and sort suggestions
  const suggestions = Object.entries(collections)
    .filter(([name]) => name.toLowerCase().startsWith(prefix.toLowerCase()))
    .map(([name, address]) => ({ name, address }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return suggestions.slice(0, 5); // Return top 5 suggestions
}
