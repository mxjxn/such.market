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
const POPULATE_LOCK_KEY = (contractAddress: string) => 
  `such-market:collection:${contractAddress}:populate:lock`;

// Enhanced discovery functions (simplified version for background population)
async function discoverNFTsComprehensive(
  contractAddress: string, 
  collection: { name: string; total_supply?: number | null }
): Promise<string[]> {
  const discoveredTokenIds = new Set<string>();
  
  console.log(`🚀 [Populate] Starting comprehensive NFT discovery for collection: ${collection.name}`);
  
  // Method 1: Comprehensive Alchemy discovery
  let pageKey: string | undefined = '0';
  let totalDiscovered = 0;
  
  do {
    try {
      const response = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: 100,
        pageKey,
      });
      
      const { nfts, pageKey: nextPageKey } = response;
      
      if (nfts && nfts.length > 0) {
        nfts.forEach((nft: ExtendedNft) => {
          discoveredTokenIds.add(nft.tokenId);
          totalDiscovered++;
        });
        
        console.log(`✅ [Populate] Alchemy batch: found ${nfts.length} tokens (total: ${totalDiscovered})`);
      }
      
      pageKey = nextPageKey;
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ [Populate] Alchemy discovery error:`, error);
      break;
    }
  } while (pageKey);
  
  // Method 2: Sequential discovery for standard collections
  if (collection.total_supply && collection.total_supply < 10000) {
    console.log(`🔍 [Populate] Collection has ${collection.total_supply} total supply, attempting sequential discovery`);
    
    const batchSize = 50;
    const batches = Math.ceil(collection.total_supply / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const startToken = batch * batchSize;
      const endToken = Math.min((batch + 1) * batchSize, collection.total_supply);
      
      console.log(`🔍 [Populate] Checking batch ${batch + 1}/${batches}: tokens ${startToken}-${endToken - 1}`);
      
      for (let tokenId = startToken; tokenId < endToken; tokenId++) {
        try {
          const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId.toString()) as ExtendedNft;
          if (nft) {
            discoveredTokenIds.add(tokenId.toString());
            console.log(`✅ [Populate] Found token ${tokenId} via sequential discovery`);
          }
        } catch (error) {
          // Token doesn't exist or other error - continue
          console.log(`⚠️ [Populate] Token ${tokenId} not found or error:`, error instanceof Error ? error.message : 'Unknown error');
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  const finalTokenIds = Array.from(discoveredTokenIds);
  console.log(`✅ [Populate] Comprehensive discovery completed. Total unique tokens found: ${finalTokenIds.length}`);
  
  return finalTokenIds;
}

async function populateCollectionComprehensive(
  contractAddress: string, 
  collectionId: string
): Promise<void> {
  console.log(`🔄 [Populate] Starting comprehensive population for collection: ${contractAddress}`);
  
  try {
    // Get collection details
    const collection = await getCollectionByAddress(contractAddress);
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    // Discover all NFTs
    const discoveredTokenIds = await discoverNFTsComprehensive(contractAddress, collection);
    
    console.log(`🎯 [Populate] Discovery completed. Found ${discoveredTokenIds.length} unique tokens`);
    
    if (discoveredTokenIds.length > 0) {
      // Fetch metadata for discovered tokens in batches
      const batchSize = 10; // Smaller batches for background processing
      const batches = Math.ceil(discoveredTokenIds.length / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchTokenIds = discoveredTokenIds.slice(batch * batchSize, (batch + 1) * batchSize);
        
        console.log(`📦 [Populate] Processing batch ${batch + 1}/${batches}: ${batchTokenIds.length} tokens`);
        
        const nftMetadataPromises = batchTokenIds.map(async (tokenId) => {
          try {
            const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId) as ExtendedNft;
            if (nft) {
              return {
                id: uuidv4(),
                collection_id: collectionId,
                token_id: nft.tokenId,
                title: nft.title || `NFT #${nft.tokenId}`,
                description: nft.description || null,
                image_url: nft.media[0]?.gateway || null,
                thumbnail_url: nft.media[0]?.thumbnail || null,
                metadata: nft.rawMetadata ? JSON.stringify(nft.rawMetadata) : null,
                attributes: nft.rawMetadata?.attributes || null,
                media: nft.media.map((m: ExtendedNft['media'][0]) => ({
                  gateway: m.gateway || null,
                  thumbnail: m.thumbnail || null,
                  raw: m.raw || null,
                  format: m.format || 'image',
                  bytes: m.bytes || 0,
                })),
                owner_address: null,
                last_owner_check_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }
          } catch (error) {
            console.warn(`⚠️ [Populate] Error fetching metadata for token ${tokenId}:`, error);
            return null;
          }
        });

        const nftMetadataResults = await Promise.all(nftMetadataPromises);
        const validNFTMetadata = nftMetadataResults.filter(Boolean);

        if (validNFTMetadata.length > 0) {
          // Store NFTs in database
          const { error: upsertError } = await supabase
            .from('nfts')
            .upsert(validNFTMetadata, { onConflict: 'collection_id,token_id' });

          if (upsertError) {
            console.error('❌ [Populate] Error upserting NFTs:', upsertError);
            throw upsertError;
          }

          console.log(`✅ [Populate] Successfully processed batch ${batch + 1}: ${validNFTMetadata.length} NFTs`);
        }
        
        // Add delay between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      console.warn(`⚠️ [Populate] No NFTs discovered for collection ${contractAddress}`);
    }

    // Update collection refresh timestamp
    const { error: updateError } = await supabase
      .from('collections')
      .update({
        last_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId);

    if (updateError) {
      console.error('❌ [Populate] Error updating collection timestamp:', updateError);
    }

    console.log(`✅ [Populate] Comprehensive population completed successfully`);

  } catch (error) {
    console.error('❌ [Populate] Error during comprehensive population:', error);
    throw error;
  }
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

    console.log(`🔄 [Populate] Starting background population for collection: ${contractAddress}`);

    // Check if population is already in progress
    if (isRedisConfigured && redis) {
      const lockKey = POPULATE_LOCK_KEY(contractAddress);
      const lockExists = await redis.get(lockKey);
      
      if (lockExists) {
        console.log(`⏳ [Populate] Population already in progress for: ${contractAddress}`);
        return NextResponse.json(
          { error: 'Population already in progress' },
          { status: 429 }
        );
      }

      // Set population lock (30 minutes for comprehensive population)
      await redis.setex(lockKey, 1800, { timestamp: Date.now() });
    }

    // Get or create collection
    let collection = await getCollectionByAddress(contractAddress.toLowerCase());
    
    if (!collection) {
      console.log(`🔄 [Populate] Collection not found, fetching metadata...`);
      collection = await fetchAndStoreCollectionMetadata(contractAddress);
      
      if (!collection) {
        console.error(`❌ [Populate] Failed to fetch collection metadata`);
        return NextResponse.json(
          { error: 'Collection not found and could not be fetched' },
          { status: 404 }
        );
      }
    }

    // Start background population (non-blocking)
    setImmediate(async () => {
      try {
        await populateCollectionComprehensive(contractAddress, collection.id);
        
        // Emit cache invalidation event (using existing system)
        await emitCacheEvent(createCacheEvent.collectionRefreshed(contractAddress));
        
        console.log(`✅ [Populate] Collection ${contractAddress} populated successfully`);
      } catch (error) {
        console.error(`❌ [Populate] Failed to populate collection ${contractAddress}:`, error);
      } finally {
        // Clear population lock
        if (isRedisConfigured && redis) {
          const lockKey = POPULATE_LOCK_KEY(contractAddress);
          await redis.del(lockKey);
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Collection population started in background',
      collectionId: collection.id,
      collectionName: collection.name,
    });

  } catch (error) {
    console.error('❌ [Populate] Error in populate endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Add GET endpoint to check population status
export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await context.params;
    
    let lockExpiry: number | null = null;
    if (isRedisConfigured && redis) {
      lockExpiry = await redis.get<number>(POPULATE_LOCK_KEY(contractAddress));
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const canPopulate = !lockExpiry || lockExpiry <= now;
    const nextPopulateTime = lockExpiry ? new Date(lockExpiry * 1000).toISOString() : null;
    
    // Also check if collection exists
    const collection = await getCollectionByAddress(contractAddress);
    
    return NextResponse.json({
      canPopulate,
      nextPopulateTime,
      remainingTime: lockExpiry ? Math.ceil((lockExpiry - now) / 60) : 0, // in minutes
      collection: collection ? {
        id: collection.id,
        name: collection.name,
        tokenType: collection.token_type,
        lastRefresh: collection.last_refresh_at,
      } : null,
    });
  } catch (error) {
    console.error('❌ Error checking populate status:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: (await context.params).contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to check populate status' },
      { status: 500 }
    );
  }
} 