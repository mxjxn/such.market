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

// Enhanced discovery functions
async function discoverSequentialNFTs(
  contractAddress: string, 
  discoveredTokenIds: Set<string>, 
  totalSupply: number
): Promise<void> {
  console.log(`🔍 [Discovery] Starting sequential discovery for ${totalSupply} tokens`);
  
  // Check tokens in batches to avoid overwhelming the API
  const batchSize = 50;
  const batches = Math.ceil(totalSupply / batchSize);
  
  for (let batch = 0; batch < batches; batch++) {
    const startToken = batch * batchSize;
    const endToken = Math.min((batch + 1) * batchSize, totalSupply);
    
    console.log(`🔍 [Discovery] Checking batch ${batch + 1}/${batches}: tokens ${startToken}-${endToken - 1}`);
    
    // Check each token in the batch
    for (let tokenId = startToken; tokenId < endToken; tokenId++) {
      try {
        const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId.toString());
        if (nft) {
          discoveredTokenIds.add(tokenId.toString());
          console.log(`✅ [Discovery] Found token ${tokenId} via sequential discovery`);
        }
      } catch (error) {
        // Token doesn't exist or other error - continue
        console.log(`⚠️ [Discovery] Token ${tokenId} not found or error:`, error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ [Discovery] Sequential discovery completed. Found ${discoveredTokenIds.size} tokens`);
}

async function discoverViaAlchemyComprehensive(
  contractAddress: string, 
  discoveredTokenIds: Set<string>
): Promise<void> {
  console.log(`🔍 [Discovery] Starting comprehensive Alchemy discovery`);
  
  let pageKey: string | undefined = '0';
  let totalDiscovered = 0;
  
  do {
    try {
      const response = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: 100, // Increased from 20
        pageKey,
      });
      
      const { nfts, pageKey: nextPageKey } = response;
      
      if (nfts && nfts.length > 0) {
        nfts.forEach((nft: ExtendedNft) => {
          discoveredTokenIds.add(nft.tokenId);
          totalDiscovered++;
        });
        
        console.log(`✅ [Discovery] Alchemy batch: found ${nfts.length} tokens (total: ${totalDiscovered})`);
      }
      
      pageKey = nextPageKey;
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ [Discovery] Alchemy discovery error:`, error);
      break;
    }
  } while (pageKey);
  
  console.log(`✅ [Discovery] Comprehensive Alchemy discovery completed. Found ${totalDiscovered} tokens`);
}

async function discoverNFTsOptimized(
  contractAddress: string, 
  collection: { name: string; total_supply?: number | null }
): Promise<string[]> {
  const discoveredTokenIds = new Set<string>();
  
  console.log(`🚀 [Discovery] Starting optimized NFT discovery for collection: ${collection.name}`);
  
  // Method 1: Comprehensive Alchemy discovery (always try first)
  await discoverViaAlchemyComprehensive(contractAddress, discoveredTokenIds);
  
  // Method 2: Sequential discovery for standard collections
  if (collection.total_supply && collection.total_supply < 10000) {
    console.log(`🔍 [Discovery] Collection has ${collection.total_supply} total supply, attempting sequential discovery`);
    await discoverSequentialNFTs(contractAddress, discoveredTokenIds, collection.total_supply);
  } else {
    console.log(`ℹ️ [Discovery] Skipping sequential discovery - total supply: ${collection.total_supply || 'unknown'}`);
  }
  
  const finalTokenIds = Array.from(discoveredTokenIds);
  console.log(`✅ [Discovery] Optimized discovery completed. Total unique tokens found: ${finalTokenIds.length}`);
  
  return finalTokenIds;
}

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

    console.log(`🔄 [Refresh] Starting enhanced refresh for collection: ${contractAddress}`);

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

      // Set refresh lock (10 minutes for enhanced discovery)
      await redis.setex(lockKey, 600, { timestamp: Date.now() });
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
      // Enhanced discovery: Use multiple methods to find ALL NFTs
      const discoveredTokenIds = await discoverNFTsOptimized(contractAddress, nonNullCollection);
      
      console.log(`🎯 [Refresh] Discovery completed. Found ${discoveredTokenIds.length} unique tokens`);
      
      if (discoveredTokenIds.length > 0) {
        // Fetch metadata for discovered tokens
        const nftMetadataPromises = discoveredTokenIds.map(async (tokenId) => {
          try {
            const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId) as ExtendedNft;
            if (nft) {
              return {
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
              };
            }
          } catch (error) {
            console.warn(`⚠️ [Refresh] Error fetching metadata for token ${tokenId}:`, error);
            return null;
          }
        });

        const nftMetadataResults = await Promise.all(nftMetadataPromises);
        const validNFTMetadata = nftMetadataResults.filter(Boolean);

        console.log(`📊 [Refresh] Metadata fetch results: ${validNFTMetadata.length}/${discoveredTokenIds.length} successful`);

        if (validNFTMetadata.length > 0) {
          // Store NFTs in database
          const { error: upsertError } = await supabase
            .from('nfts')
            .upsert(
              validNFTMetadata.map(nft => ({
                id: uuidv4(),
                collection_id: nonNullCollection.id,
                token_id: nft!.tokenId,
                title: nft!.title,
                description: nft!.description,
                image_url: nft!.imageUrl,
                thumbnail_url: nft!.thumbnailUrl,
                metadata: nft!.metadata,
                attributes: nft!.attributes,
                media: nft!.media,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'collection_id,token_id' }
            );

          if (upsertError) {
            console.error('❌ [Refresh] Error upserting NFTs:', upsertError);
            throw upsertError;
          }

          console.log(`✅ [Refresh] Successfully refreshed ${validNFTMetadata.length} NFTs`);
        }
      } else {
        console.warn(`⚠️ [Refresh] No NFTs discovered for collection ${contractAddress}`);
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

      console.log(`✅ [Refresh] Enhanced collection refresh completed successfully`);

      return NextResponse.json({
        success: true,
        message: `Successfully refreshed collection: ${nonNullCollection.name}`,
        nftsDiscovered: discoveredTokenIds.length,
        nftsProcessed: validNFTMetadata?.length || 0,
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