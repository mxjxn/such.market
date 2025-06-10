import { FrameNotificationDetails } from "@farcaster/frame-sdk";
import { 
  redis, 
  isRedisConfigured, 
  REDIS_CONFIG,
  getCachedData,
  setCachedData
} from "./redis";
import { APP_NAME } from "./constants";

// In-memory fallback storage
const localStore = new Map<string, FrameNotificationDetails>();
const localCollections = new Map<string, string>();

// Log Redis configuration status
console.log('🔧 [KV Store] Redis configuration status:', {
  configured: isRedisConfigured,
  url: REDIS_CONFIG.url ? '✅ Set' : '❌ Not set',
  token: REDIS_CONFIG.token ? '✅ Set' : '❌ Not set',
  appName: APP_NAME,
});

// Frame notification functions
export async function addFrameNotification(notification: FrameNotificationDetails): Promise<void> {
  console.log('📝 [KV Store] Adding frame notification:', { 
    type: notification.type,
    timestamp: notification.timestamp 
  });
  
  if (isRedisConfigured && redis) {
    console.log('🔑 [KV Store] Using Redis for storage');
    const key = `${APP_NAME}:frame:notification:${notification.timestamp}`;
    await setCachedData(key, notification, REDIS_CONFIG.ttl.hot);
    
    // Verify the write
    const verifyNotification = await getCachedData<FrameNotificationDetails>(key);
    console.log('✅ [KV Store] Verification after write:', {
      success: !!verifyNotification,
      type: verifyNotification?.type
    });
  } else {
    console.log('⚠️ [KV Store] Using in-memory storage (Redis not configured)');
    localStore.set(notification.timestamp.toString(), notification);
    console.log('📚 [KV Store] Current notifications in memory:', {
      count: localStore.size
    });
  }
}

export async function getFrameNotifications(): Promise<FrameNotificationDetails[]> {
  console.log('🔍 [KV Store] Fetching frame notifications...');
  
  if (isRedisConfigured && redis) {
    console.log('🔑 [KV Store] Using Redis for retrieval');
    const keys = await redis.keys(`${APP_NAME}:frame:notification:*`);
    const notifications: FrameNotificationDetails[] = [];
    
    for (const key of keys) {
      const notification = await getCachedData<FrameNotificationDetails>(key);
      if (notification) {
        notifications.push(notification);
      }
    }
    
    console.log('📚 [KV Store] Retrieved from Redis:', { 
      count: notifications.length,
      notifications: notifications.map(n => ({ type: n.type, timestamp: n.timestamp }))
    });
    return notifications;
  } else {
    console.log('⚠️ [KV Store] Using in-memory storage (Redis not configured)');
    const notifications = Array.from(localStore.values());
    console.log('📚 [KV Store] Retrieved from memory:', {
      count: notifications.length,
      notifications: notifications.map(n => ({ type: n.type, timestamp: n.timestamp }))
    });
    return notifications;
  }
}

// Collection name functions
export async function addCollectionName(name: string, address: string): Promise<void> {
  console.log('📝 [KV Store] Adding collection:', { name, address });
  
  if (isRedisConfigured && redis) {
    console.log('🔑 [KV Store] Using Redis for storage');
    const key = `${APP_NAME}:collections:names`;
    const collections = await getCachedData<Record<string, string>>(key) || {};
    
    collections[name] = address;
    await setCachedData(key, collections, REDIS_CONFIG.ttl.cold);
    
    // Verify the write
    const verifyCollections = await getCachedData<Record<string, string>>(key);
    console.log('✅ [KV Store] Verification after write:', {
      success: verifyCollections?.[name] === address,
      count: Object.keys(verifyCollections || {}).length
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
  
  if (isRedisConfigured && redis) {
    console.log('🔑 [KV Store] Using Redis for retrieval');
    const key = `${APP_NAME}:collections:names`;
    const collections = await getCachedData<Record<string, string>>(key) || {};
    
    console.log('📚 [KV Store] Retrieved from Redis:', { 
      count: Object.keys(collections).length,
      collections: Object.entries(collections)
    });
    return collections;
  } else {
    console.log('⚠️ [KV Store] Using in-memory storage (Redis not configured)');
    const collections = Object.fromEntries(localCollections);
    console.log('📚 [KV Store] Retrieved from memory:', {
      count: Object.keys(collections).length,
      collections: Object.entries(localCollections)
    });
    return collections;
  }
}

export async function getCollectionSuggestions(prefix: string): Promise<Array<{ name: string; address: string }>> {
  if (!redis) return [];
  
  // Get all collection names
  const collections = await redis.hgetall<Record<string, string>>(CACHE_KEYS.collections);
  if (!collections) return [];

  // Filter and sort suggestions
  const suggestions = Object.entries(collections)
    .filter(([name]) => name.toLowerCase().startsWith(prefix.toLowerCase()))
    .map(([name, address]) => ({ name, address }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return suggestions.slice(0, 5); // Return top 5 suggestions
}
