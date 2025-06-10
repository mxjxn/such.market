import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getCollectionByAddress, fetchAndStoreCollectionMetadata } from '~/lib/db/collections';
import { getSupabaseClient } from '~/lib/supabase';
import { Alchemy, Network, Nft } from 'alchemy-sdk';
import { v4 as uuidv4 } from 'uuid';

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

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Initialize Supabase client
const supabase = getSupabaseClient();

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Cache keys
const REFRESH_LOCK_KEY = (contractAddress: string) => 
  `nft:collection:${contractAddress}:refresh:lock`;

// Rate limit settings
const REFRESH_COOLDOWN = 1800; // 30 minutes in seconds

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  const { contractAddress } = await params;
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`🔄 [${requestId}] Cache Refresh Request:`, {
    url: request.url,
    method: request.method,
    contractAddress,
  });
  
  try {
    // Validate contract address
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      console.log('❌ Invalid contract address:', contractAddress);
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Check if refresh is locked
    const lockExpiry = await redis.get<number>(REFRESH_LOCK_KEY(contractAddress));
    const now = Math.floor(Date.now() / 1000);
    
    if (lockExpiry && lockExpiry > now) {
      const remainingTime = Math.ceil((lockExpiry - now) / 60); // Convert to minutes
      return NextResponse.json(
        { 
          error: 'Refresh is rate limited',
          message: `Please wait ${remainingTime} minutes before refreshing again`,
          nextRefreshTime: new Date(lockExpiry * 1000).toISOString(),
        },
        { status: 429 }
      );
    }

    // Set refresh lock
    await redis.set(
      REFRESH_LOCK_KEY(contractAddress),
      now + REFRESH_COOLDOWN,
      { ex: REFRESH_COOLDOWN }
    );

    // Delete all cached pages and collection index
    const keys = await redis.keys(`nft:collection:${contractAddress}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    console.log('🔄 Manual refresh initiated:', {
      contractAddress,
      clearedKeys: keys.length,
      nextRefreshTime: new Date((now + REFRESH_COOLDOWN) * 1000).toISOString(),
    });

    // Step 1: Check database
    console.log(`📦 [${requestId}] Checking database for collection...`);
    let collection = await getCollectionByAddress(contractAddress);
    
    if (!collection) {
      console.log(`🔄 [${requestId}] Collection not found in database, fetching metadata...`);
      
      // Step 2: Try to fetch and store collection metadata
      try {
        // This will try Alchemy first, then fall back to on-chain
        collection = await fetchAndStoreCollectionMetadata(contractAddress);
        
        if (!collection) {
          console.error(`❌ [${requestId}] Failed to fetch collection metadata from both Alchemy and on-chain`);
          return NextResponse.json(
            { error: 'Failed to fetch collection metadata' },
            { status: 404 }
          );
        }
        
        console.log(`✅ [${requestId}] Collection metadata fetched and stored:`, {
          id: collection.id,
          name: collection.name,
          tokenType: collection.token_type,
        });

        // At this point, collection is guaranteed to be non-null
        const nonNullCollection = collection;

        // Step 3: Fetch first page of NFTs for new collections using Alchemy
        console.log(`🔄 [${requestId}] Fetching first page of NFTs using Alchemy...`);
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
              console.error(`❌ [${requestId}] Error storing NFTs:`, {
                error: upsertError,
                contractAddress,
                collectionId: nonNullCollection.id,
                nftCount: nftMetadata.length,
              });
            } else {
              console.log(`✅ [${requestId}] Successfully stored NFTs:`, {
                count: nftMetadata.length,
                firstNFT: nftMetadata[0] ? {
                  tokenId: nftMetadata[0].tokenId,
                  title: nftMetadata[0].title,
                  hasImage: !!nftMetadata[0].imageUrl,
                } : null,
              });
            }
          } else {
            console.log(`ℹ️ [${requestId}] No NFTs found in Alchemy for collection:`, {
              contractAddress,
              collectionId: nonNullCollection.id,
            });
          }
        } catch (error) {
          console.error(`⚠️ [${requestId}] Error fetching NFTs from Alchemy:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            contractAddress,
            collectionId: nonNullCollection.id,
          });
          // Don't throw here - we still want to return the collection data
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Failed to fetch collection metadata:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          contractAddress,
        });
        return NextResponse.json(
          { error: 'Failed to fetch collection metadata' },
          { status: 404 }
        );
      }
    } else {
      // Update collection refresh time
      console.log('⏰ Updating collection refresh time...');
      const { error: updateError } = await supabase
        .from('collections')
        .update({ 
          last_refresh_at: new Date().toISOString(),
          refresh_cooldown_until: new Date((now + REFRESH_COOLDOWN) * 1000).toISOString()
        })
        .eq('contract_address', contractAddress.toLowerCase());
        
      if (updateError) {
        console.error('❌ Failed to update collection refresh time:', updateError);
      } else {
        console.log('✅ Collection refresh time updated');
      }
    }

    // Verify we have the collection data
    if (!collection) {
      console.error('❌ No collection data available after refresh');
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Collection refresh completed',
      nextRefreshTime: new Date((now + REFRESH_COOLDOWN) * 1000).toISOString(),
      collection: {
        id: collection.id,
        name: collection.name,
        tokenType: collection.token_type,
        contractAddress: collection.contract_address,
        totalSupply: collection.total_supply,
        lastRefresh: collection.last_refresh_at,
      },
    });
  } catch (error) {
    console.error('❌ Error in refresh endpoint:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to refresh collection' },
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
    const lockExpiry = await redis.get<number>(REFRESH_LOCK_KEY(contractAddress));
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