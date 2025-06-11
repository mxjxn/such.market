import { NextRequest, NextResponse } from 'next/server';
import { getCollectionByAddress, fetchAndStoreCollectionMetadata } from '~/lib/db/collections';
import { getSupabaseClient } from '~/lib/supabase';
import { Alchemy, Network, Nft } from 'alchemy-sdk';
import { v4 as uuidv4 } from 'uuid';
import { redis, isRedisConfigured, CACHE_KEYS, invalidateCache } from '~/lib/redis';
import { emitCacheEvent, createCacheEvent } from '~/lib/cache/events';

// Define extended NFT type to include all properties we need
interface ExtendedNft extends Nft {
  title?: string;
  description?: string;
  media: Array<{
    gateway?: string;
    thumbnail?: string;
    raw?: string;
    format?: string;
    bytes?: number;
  }>;
  rawMetadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
    [key: string]: unknown;
  };
}

// Initialize Supabase client
const supabase = getSupabaseClient();

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Cache keys
const REFRESH_LOCK_KEY = (contractAddress: string) => 
  `such-market:collection:${contractAddress}:refresh:lock`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    console.log(`🔄 [Refresh] Starting refresh for collection: ${contractAddress}`);

    // Check if refresh is already in progress
    if (isRedisConfigured && redis) {
      const lockKey = REFRESH_LOCK_KEY(contractAddress);
      const lockExists = await redis.get(lockKey);
      
      if (lockExists) {
        console.log(`⏳ [Refresh] Refresh already in progress for: ${contractAddress}`);
        return NextResponse.json(
          { error: 'Refresh already in progress' },
          { status: 429 }
        );
      }

      // Set refresh lock (5 minutes)
      await redis.setex(lockKey, 300, { timestamp: Date.now() });
    }

    // Get or create collection
    let collection = await getCollectionByAddress(contractAddress.toLowerCase());
    
    if (!collection) {
      console.log(`🔄 [Refresh] Collection not found, fetching metadata...`);
      collection = await fetchAndStoreCollectionMetadata(contractAddress);
      
      if (!collection) {
        console.error(`❌ [Refresh] Failed to fetch collection metadata`);
        return NextResponse.json(
          { error: 'Collection not found and could not be fetched' },
          { status: 404 }
        );
      }
    }

    const nonNullCollection = collection;

    // Check if collection is in cooldown
    if (nonNullCollection.refresh_cooldown_until) {
      const cooldownUntil = new Date(nonNullCollection.refresh_cooldown_until);
      const now = new Date();
      
      if (now < cooldownUntil) {
        const remainingMinutes = Math.ceil((cooldownUntil.getTime() - now.getTime()) / (1000 * 60));
        console.log(`⏳ [Refresh] Collection in cooldown for ${remainingMinutes} more minutes`);
        return NextResponse.json(
          { 
            error: 'Collection refresh in cooldown',
            cooldownUntil: nonNullCollection.refresh_cooldown_until,
            remainingMinutes
          },
          { status: 429 }
        );
      }
    }

    console.log(`✅ [Refresh] Refreshing collection: ${nonNullCollection.name}`);

    try {
      const pageSize = 20; // Default page size
      const options = {
        pageSize,
        pageKey: '0', // Start from the beginning
      };

      const { nfts: alchemyNFTs } = await alchemy.nft.getNftsForContract(contractAddress, options);
      
      if (alchemyNFTs && alchemyNFTs.length > 0) {
        // Convert Alchemy NFTs to our format
        const nftMetadata = (alchemyNFTs as ExtendedNft[]).map(nft => ({
          tokenId: nft.tokenId,
          title: nft.title || `NFT #${nft.tokenId}`,
          description: nft.description || null,
          imageUrl: nft.media[0]?.gateway || null,
          thumbnailUrl: nft.media[0]?.thumbnail || null,
          metadata: nft.rawMetadata || undefined,
          attributes: nft.rawMetadata?.attributes || undefined,
          media: nft.media.map((m: ExtendedNft['media'][0]) => ({
            gateway: m.gateway || null,
            thumbnail: m.thumbnail || null,
            raw: m.raw || null,
            format: m.format || 'image',
            bytes: m.bytes || 0,
          })),
        }));

        // Store NFTs in database
        const { error: upsertError } = await supabase
          .from('nfts')
          .upsert(
            nftMetadata.map(nft => ({
              id: uuidv4(),
              collection_id: nonNullCollection.id,
              token_id: nft.tokenId,
              title: nft.title,
              description: nft.description,
              image_url: nft.imageUrl,
              thumbnail_url: nft.thumbnailUrl,
              metadata: nft.metadata,
              attributes: nft.attributes,
              media: nft.media,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'collection_id,token_id' }
          );

        if (upsertError) {
          console.error('❌ [Refresh] Error upserting NFTs:', upsertError);
          throw upsertError;
        }

        console.log(`✅ [Refresh] Successfully refreshed ${nftMetadata.length} NFTs`);
      }

      // Update collection refresh timestamp and cooldown
      const cooldownUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      
      const { error: updateError } = await supabase
        .from('collections')
        .update({
          last_refresh_at: new Date().toISOString(),
          refresh_cooldown_until: cooldownUntil.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', nonNullCollection.id);

      if (updateError) {
        console.error('❌ [Refresh] Error updating collection refresh timestamp:', updateError);
      }

      // Invalidate cache
      await invalidateCache(`${CACHE_KEYS.collectionMetadata(contractAddress).split(':metadata')[0]}:*`);

      // Emit cache invalidation event
      await emitCacheEvent(createCacheEvent.collectionRefreshed(contractAddress));

      console.log(`✅ [Refresh] Collection refresh completed successfully`);

      return NextResponse.json({
        success: true,
        message: `Successfully refreshed collection: ${nonNullCollection.name}`,
        nftsProcessed: alchemyNFTs?.length || 0,
        cooldownUntil: cooldownUntil.toISOString(),
      });

    } catch (error) {
      console.error('❌ [Refresh] Error during refresh:', error);
      throw error;
    } finally {
      // Clear refresh lock
      if (isRedisConfigured && redis) {
        const lockKey = REFRESH_LOCK_KEY(contractAddress);
        await redis.del(lockKey);
      }
    }

  } catch (error) {
    console.error('❌ [Refresh] Error in refresh endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Add GET endpoint to check refresh status
export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await context.params;
    
    let lockExpiry: number | null = null;
    if (isRedisConfigured && redis) {
      lockExpiry = await redis.get<number>(REFRESH_LOCK_KEY(contractAddress));
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const canRefresh = !lockExpiry || lockExpiry <= now;
    const nextRefreshTime = lockExpiry ? new Date(lockExpiry * 1000).toISOString() : null;
    
    // Also check if collection exists
    const collection = await getCollectionByAddress(contractAddress);
    
    return NextResponse.json({
      canRefresh,
      nextRefreshTime,
      remainingTime: lockExpiry ? Math.ceil((lockExpiry - now) / 60) : 0, // in minutes
      collection: collection ? {
        id: collection.id,
        name: collection.name,
        tokenType: collection.token_type,
        lastRefresh: collection.last_refresh_at,
      } : null,
    });
  } catch (error) {
    console.error('❌ Error checking refresh status:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: (await context.params).contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to check refresh status' },
      { status: 500 }
    );
  }
} 