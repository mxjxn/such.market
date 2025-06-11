import { isRedisConfigured, CACHE_KEYS, invalidateCache } from '../redis';

// Cache event types
export type CacheEventType = 
  | 'collection_updated'
  | 'nft_transferred' 
  | 'user_updated'
  | 'collection_refreshed'
  | 'ownership_changed'
  | 'cache_cleared';

// Cache event data structure
export interface CacheEvent {
  id: string;
  type: CacheEventType;
  data: {
    contractAddress?: string;
    tokenId?: string;
    fid?: number;
    walletAddress?: string;
    collectionId?: string;
    reason?: string;
  };
  timestamp: number;
  source: 'database' | 'api' | 'manual' | 'system';
}

// Event handler function type
export type CacheEventHandler = (event: CacheEvent) => Promise<void>;

// Event queue for processing cache events
class CacheEventQueue {
  private events: CacheEvent[] = [];
  private handlers: Map<CacheEventType, CacheEventHandler[]> = new Map();
  private isProcessing = false;

  // Add event to queue
  async addEvent(event: Omit<CacheEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: CacheEvent = {
      ...event,
      id: `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);
    console.log('📝 [Cache Events] Event queued:', {
      id: fullEvent.id,
      type: fullEvent.type,
      data: fullEvent.data,
    });

    // Process events asynchronously
    if (!this.isProcessing) {
      this.processEvents();
    }
  }

  // Register event handler
  on(eventType: CacheEventType, handler: CacheEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  // Process all queued events
  private async processEvents(): Promise<void> {
    if (this.isProcessing || this.events.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 [Cache Events] Processing events:', this.events.length);

    while (this.events.length > 0) {
      const event = this.events.shift()!;
      await this.processEvent(event);
    }

    this.isProcessing = false;
    console.log('✅ [Cache Events] All events processed');
  }

  // Process individual event
  private async processEvent(event: CacheEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    
    console.log('🎯 [Cache Events] Processing event:', {
      id: event.id,
      type: event.type,
      handlers: handlers.length,
    });

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('❌ [Cache Events] Handler error:', {
          eventId: event.id,
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // Get queue status
  getStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.events.length,
      isProcessing: this.isProcessing,
    };
  }
}

// Global event queue instance
export const cacheEventQueue = new CacheEventQueue();

// Event factory functions
export const createCacheEvent = {
  collectionUpdated: (contractAddress: string, reason?: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'collection_updated',
    data: { contractAddress, reason },
    source: 'database',
  }),

  nftTransferred: (contractAddress: string, tokenId: string, fromAddress?: string, toAddress?: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'nft_transferred',
    data: { contractAddress, tokenId, walletAddress: toAddress },
    source: 'database',
  }),

  userUpdated: (fid: number, reason?: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'user_updated',
    data: { fid, reason },
    source: 'database',
  }),

  collectionRefreshed: (contractAddress: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'collection_refreshed',
    data: { contractAddress, reason: 'manual_refresh' },
    source: 'api',
  }),

  ownershipChanged: (contractAddress: string, tokenId: string, walletAddress: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'ownership_changed',
    data: { contractAddress, tokenId, walletAddress },
    source: 'database',
  }),

  cacheCleared: (pattern?: string): Omit<CacheEvent, 'id' | 'timestamp'> => ({
    type: 'cache_cleared',
    data: { reason: pattern || 'manual_clear' },
    source: 'manual',
  }),
};

// Default event handlers
export const defaultEventHandlers = {
  // Handle collection updates
  collectionUpdated: async (event: CacheEvent): Promise<void> => {
    const { contractAddress } = event.data;
    if (!contractAddress) return;

    console.log('🗑️ [Cache Events] Invalidating collection cache:', contractAddress);
    
    // Invalidate collection-related caches
    await invalidateCache(`${CACHE_KEYS.collectionMetadata(contractAddress).split(':metadata')[0]}:*`);
    
    // Also invalidate collection stats and traits
    await invalidateCache(`${CACHE_KEYS.collectionStats(contractAddress).split(':stats')[0]}:*`);
  },

  // Handle NFT transfers
  nftTransferred: async (event: CacheEvent): Promise<void> => {
    const { contractAddress, tokenId, walletAddress } = event.data;
    if (!contractAddress || !tokenId) return;

    console.log('🗑️ [Cache Events] Invalidating NFT ownership cache:', { contractAddress, tokenId });
    
    // Invalidate specific NFT ownership cache
    await invalidateCache(CACHE_KEYS.nftOwnership(contractAddress, tokenId));
    
    // Invalidate wallet contracts cache if wallet address provided
    if (walletAddress) {
      await invalidateCache(`${CACHE_KEYS.walletContracts(walletAddress).split(':contracts')[0]}:*`);
    }
  },

  // Handle user updates
  userUpdated: async (event: CacheEvent): Promise<void> => {
    const { fid } = event.data;
    if (!fid) return;

    console.log('🗑️ [Cache Events] Invalidating user cache:', fid);
    
    // Invalidate user-related caches
    await invalidateCache(`${CACHE_KEYS.userCollections(fid).split(':collections')[0]}:*`);
    await invalidateCache(`${CACHE_KEYS.userProfile(fid).split(':profile')[0]}:*`);
  },

  // Handle collection refreshes
  collectionRefreshed: async (event: CacheEvent): Promise<void> => {
    const { contractAddress } = event.data;
    if (!contractAddress) return;

    console.log('🗑️ [Cache Events] Invalidating collection cache after refresh:', contractAddress);
    
    // Invalidate all collection-related caches
    await invalidateCache(`${CACHE_KEYS.collectionMetadata(contractAddress).split(':metadata')[0]}:*`);
  },

  // Handle ownership changes
  ownershipChanged: async (event: CacheEvent): Promise<void> => {
    const { contractAddress, tokenId, walletAddress } = event.data;
    if (!contractAddress || !tokenId) return;

    console.log('🗑️ [Cache Events] Invalidating ownership cache:', { contractAddress, tokenId, walletAddress });
    
    // Invalidate NFT ownership cache
    await invalidateCache(CACHE_KEYS.nftOwnership(contractAddress, tokenId));
    
    // Invalidate wallet contracts cache
    if (walletAddress) {
      await invalidateCache(`${CACHE_KEYS.walletContracts(walletAddress).split(':contracts')[0]}:*`);
    }
  },

  // Handle cache clears
  cacheCleared: async (event: CacheEvent): Promise<void> => {
    const { reason } = event.data;
    
    console.log('🗑️ [Cache Events] Cache cleared:', reason);
    
    // This is handled by the manual cache clear function
    // Just log the event for analytics
  },
};

// Initialize default event handlers
export function initializeEventHandlers(): void {
  console.log('🔧 [Cache Events] Initializing event handlers');
  
  cacheEventQueue.on('collection_updated', defaultEventHandlers.collectionUpdated);
  cacheEventQueue.on('nft_transferred', defaultEventHandlers.nftTransferred);
  cacheEventQueue.on('user_updated', defaultEventHandlers.userUpdated);
  cacheEventQueue.on('collection_refreshed', defaultEventHandlers.collectionRefreshed);
  cacheEventQueue.on('ownership_changed', defaultEventHandlers.ownershipChanged);
  cacheEventQueue.on('cache_cleared', defaultEventHandlers.cacheCleared);
  
  console.log('✅ [Cache Events] Event handlers initialized');
}

// Helper function to emit events
export async function emitCacheEvent(event: Omit<CacheEvent, 'id' | 'timestamp'>): Promise<void> {
  await cacheEventQueue.addEvent(event);
}

// Helper function to get event queue status
export function getEventQueueStatus(): { queueLength: number; isProcessing: boolean } {
  return cacheEventQueue.getStatus();
}

// Initialize handlers when module is imported
if (isRedisConfigured) {
  initializeEventHandlers();
} 