// At the very top of the file, before any imports
console.log('🔄 Loading NFT endpoint module');

// Log environment variables before any imports
const envVars = {
  hasAlchemyKey: !!process.env.ALCHEMY_API_KEY,
  hasBaseRpcUrl: !!process.env.BASE_MAINNET_RPC,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  nodeEnv: process.env.NODE_ENV,
};
console.log('🔑 [NFT Endpoint] Environment variables:', envVars);

import { NextRequest, NextResponse } from 'next/server';
import { getCollectionByAddress, getCollectionNFTs } from '~/lib/db/collections';
import { fetchAndStoreNFTMetadata } from '~/lib/nft-metadata';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';

// Initialize viem client
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC!),
});

// Add ERC721 ABI items for metadata fetching
const ERC721_METADATA_ABI = [
  parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)'),
] as const;

// Add ERC1155 ABI items for metadata fetching
const ERC1155_METADATA_ABI = [
  parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)'),
  parseAbiItem('function totalSupply(uint256 id) view returns (uint256)'),
  parseAbiItem('function uri(uint256 tokenId) view returns (string)'),
] as const;

// Helper function to retry contract calls
async function retryContractCall<T>(
  address: Address,
  abi: typeof ERC721_METADATA_ABI | typeof ERC1155_METADATA_ABI,
  functionName: string,
  args: readonly unknown[],
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.readContract({
        address,
        abi,
        functionName: functionName as keyof typeof abi,
        args: args as readonly unknown[],
      }) as T;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

// Helper function to check if ERC1155 token exists
async function checkERC1155TokenExists(
  contractAddress: string, 
  tokenId: string
): Promise<boolean> {
  try {
    // For ERC1155, we check if totalSupply for this token ID is greater than 0
    const totalSupply = await client.readContract({
      address: contractAddress as Address,
      abi: ERC1155_METADATA_ABI,
      functionName: 'totalSupply' as any,
      args: [BigInt(tokenId)] as any,
    }) as bigint;
    
    return totalSupply > BigInt(0);
  } catch (error) {
    // If totalSupply doesn't exist or fails, try balanceOf with a zero address
    try {
      await client.readContract({
        address: contractAddress as Address,
        abi: ERC1155_METADATA_ABI,
        functionName: 'balanceOf' as any,
        args: ['0x0000000000000000000000000000000000000000' as Address, BigInt(tokenId)] as any,
      });
      
      // If we can call balanceOf successfully, the token ID exists
      return true;
    } catch (balanceError) {
      console.log(`⚠️ ERC1155 token ${tokenId} check failed:`, {
        totalSupplyError: error instanceof Error ? error.message : 'Unknown error',
        balanceError: balanceError instanceof Error ? balanceError.message : 'Unknown error',
      });
      return false;
    }
  }
}

// Helper function to check if ERC721 token exists
async function checkERC721TokenExists(
  contractAddress: string, 
  tokenId: string
): Promise<boolean> {
  try {
    await client.readContract({
      address: contractAddress as Address,
      abi: ERC721_METADATA_ABI,
      functionName: 'ownerOf' as any,
      args: [BigInt(tokenId)] as any,
    });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('execution reverted') || 
        errorMessage.includes('call revert exception') ||
        errorMessage.includes('ERC721: invalid token ID')) {
      return false;
    }
    // Some other error, assume it exists
    return true;
  }
}

// Helper function to trigger background population
async function triggerBackgroundPopulation(contractAddress: string): Promise<void> {
  try {
    console.log(`🔄 [Background] Triggering background population for ${contractAddress}`);
    
    // Make a non-blocking call to the populate endpoint
    const populateUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/collection/${contractAddress}/populate`;
    
    fetch(populateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(error => {
      console.warn(`⚠️ [Background] Failed to trigger background population:`, error);
    });
    
    console.log(`✅ [Background] Background population triggered for ${contractAddress}`);
  } catch (error) {
    console.warn(`⚠️ [Background] Error triggering background population:`, error);
  }
}

// Helper function to check collection health
function assessCollectionHealth(
  dbNFTs: Array<{ token_id: string; [key: string]: unknown }>, 
  pageSize: number, 
  collection: { total_supply?: number | null; last_refresh_at?: string | null; token_type?: string }
): { health: 'excellent' | 'good' | 'fair' | 'poor'; reason: string } {
  const nftCount = dbNFTs.length;
  const expectedTotal = collection.total_supply || 0;
  
  // If we have no data at all
  if (nftCount === 0) {
    return { health: 'poor', reason: 'No NFTs found' };
  }
  
  // For small collections (less than page size), check if we've reached the end
  if (nftCount < pageSize) {
    // If we have some NFTs and they have metadata, this might be a complete small collection
    const hasMetadata = dbNFTs.some(nft => {
      const hasTitle = nft.title && nft.title !== `NFT #${nft.token_id}` && nft.title !== `Token ${nft.token_id}`;
      const hasImage = nft.image_url && nft.image_url !== '';
      return hasTitle && hasImage;
    });
    
    if (hasMetadata) {
      return { health: 'excellent', reason: 'Small collection with complete metadata' };
    }
    
    // If we have incomplete metadata, it's fair
    return { health: 'fair', reason: 'Small collection with incomplete metadata' };
  }
  
  // If we have a full page of data
  if (nftCount >= pageSize) {
    return { health: 'excellent', reason: 'Complete page data' };
  }
  
  return { health: 'good', reason: 'Adequate data' };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const { contractAddress } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    console.log(`🔍 [${requestId}] NFT request:`, {
      contractAddress,
      page,
      pageSize,
      url: request.url,
    });

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error(`❌ [${requestId}] Invalid contract address:`, contractAddress);
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Get collection from database
    const collection = await getCollectionByAddress(contractAddress.toLowerCase());

    console.log(`📊 [${requestId}] Collection data:`, {
      contractAddress,
      collectionId: collection?.id,
      tokenType: collection?.token_type,
      totalSupply: collection?.total_supply,
      lastRefresh: collection?.last_refresh_at,
      raw: collection, // Log the entire collection object for debugging
    });

    if (!collection) {
      console.error(`❌ [${requestId}] Collection not found:`, contractAddress);
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Get NFTs from database
    const { nfts: dbNFTs, total } = await getCollectionNFTs(
      contractAddress,
      page,
      pageSize
    );

    console.log(`📊 [${requestId}] Database NFT stats:`, {
      nftCount: dbNFTs.length,
      total,
      page,
      pageSize,
      contractAddress,
      tokenType: collection.token_type,
    });

    // Enhanced logic: If we have incomplete data, trigger background population
    const health = assessCollectionHealth(dbNFTs, pageSize, collection);
    console.log(`🏥 [${requestId}] Collection health assessment:`, health);
    
    if (health.health === 'poor' || (health.health === 'fair' && !collection.last_refresh_at)) {
      console.log(`🔄 [${requestId}] Incomplete collection detected, triggering background population`);
      
      // Start background population (non-blocking)
      setImmediate(async () => {
        try {
          await triggerBackgroundPopulation(contractAddress);
        } catch (error) {
          console.error('❌ [${requestId}] Background population failed:', error);
        }
      });
    }

    let nfts = dbNFTs;
    let hasMore = true;

    // If we don't have a full page from the database, try to fetch missing NFTs from blockchain
    if (dbNFTs.length < pageSize) {
      console.log(`🔄 [${requestId}] Incomplete page from database (${dbNFTs.length}/${pageSize}), fetching missing NFTs from blockchain...`);
      
      // Calculate which token IDs we need to fetch
      const existingTokenIds = new Set(dbNFTs.map(nft => nft.token_id));
      const startTokenId = page * pageSize;
      const missingTokenIds = Array.from(
        { length: pageSize },
        (_, i) => String(startTokenId + i)
      ).filter(id => !existingTokenIds.has(id));

      if (missingTokenIds.length > 0) {
        console.log(`🔍 [${requestId}] Fetching missing token IDs:`, {
          missingCount: missingTokenIds.length,
          missingIds: missingTokenIds,
          tokenType: collection.token_type,
        });

        try {
          // Fetch missing NFTs from blockchain
          await fetchAndStoreNFTMetadata(
            contractAddress,
            missingTokenIds,
            collection.id
          );

          // Get all NFTs for this page (including newly fetched ones)
          const { nfts: updatedNFTs } = await getCollectionNFTs(
            contractAddress,
            page,
            pageSize
          );

          console.log(`✅ [${requestId}] Updated NFT count after blockchain fetch:`, {
            before: dbNFTs.length,
            after: updatedNFTs.length,
            missingFetched: updatedNFTs.length - dbNFTs.length,
          });

          nfts = updatedNFTs;
        } catch (error) {
          console.error(`❌ [${requestId}] Error fetching missing NFTs from blockchain:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            type: error instanceof Error ? error.name : typeof error,
          });
          // Don't throw here, we'll return what we have from the database
        }
      }
    }

    // For ERC1155 collections, if we still have no NFTs, try to discover existing tokens
    if (collection.token_type === 'ERC1155' && nfts.length === 0) {
      console.log(`🔍 [${requestId}] No NFTs found for ERC1155 collection, attempting to discover existing tokens...`);
      
      // Try common token IDs for ERC1155 collections, but stop on "Invalid token" errors
      const commonTokenIds = ['0', '1', '2', '3', '4', '5', '10', '100', '1000'];
      const discoveredTokens = [];
      let foundInvalidToken = false;
      
      for (const tokenId of commonTokenIds) {
        if (foundInvalidToken) {
          console.log(`🛑 [${requestId}] Stopping discovery after finding invalid token`);
          break;
        }
        
        try {
          console.log(`🔍 [${requestId}] Checking if ERC1155 token ${tokenId} exists...`);
          const exists = await checkERC1155TokenExists(contractAddress, tokenId);
          
          if (exists) {
            console.log(`✅ [${requestId}] Found existing ERC1155 token ${tokenId}`);
            discoveredTokens.push(tokenId);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '';
          if (errorMessage.includes('Invalid token')) {
            console.log(`🛑 [${requestId}] Found invalid token ${tokenId}, stopping discovery`);
            foundInvalidToken = true;
            break;
          } else {
            console.log(`⚠️ [${requestId}] Token ${tokenId} doesn't exist or error:`, errorMessage);
          }
        }
      }
      
      if (discoveredTokens.length > 0) {
        console.log(`🔍 [${requestId}] Found ${discoveredTokens.length} existing tokens, fetching metadata...`);
        
        try {
          // Fetch metadata for discovered tokens
          await fetchAndStoreNFTMetadata(
            contractAddress,
            discoveredTokens,
            collection.id
          );
          
          // Get the NFTs again after fetching metadata
          const { nfts: discoveredNFTs } = await getCollectionNFTs(
            contractAddress,
            page,
            pageSize
          );
          
          console.log(`✅ [${requestId}] Successfully fetched ${discoveredNFTs.length} NFTs for ERC1155 collection`);
          nfts = discoveredNFTs;
        } catch (error) {
          console.error(`❌ [${requestId}] Error fetching metadata for discovered tokens:`, error);
        }
      }
    }

    // Always check the next token on-chain to determine if we've reached the end
    try {
      const nextTokenId = (page + 1) * pageSize;
      
      // Check if the next token exists based on collection type
      let nextTokenExists = false;
      
      if (collection.token_type === 'ERC1155') {
        console.log(`🔍 [${requestId}] Checking ERC1155 token ${nextTokenId} existence...`);
        nextTokenExists = await checkERC1155TokenExists(contractAddress, nextTokenId.toString());
      } else {
        // Default to ERC721
        console.log(`🔍 [${requestId}] Checking ERC721 token ${nextTokenId} existence...`);
        nextTokenExists = await checkERC721TokenExists(contractAddress, nextTokenId.toString());
      }
      
      if (nextTokenExists) {
        hasMore = true;
        console.log(`✅ [${requestId}] Next token ${nextTokenId} exists`);
      } else {
        hasMore = false;
        console.log(`🔚 [${requestId}] Reached end of collection at token ${nextTokenId}`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error checking for more NFTs:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : typeof error,
      });
      // On error, assume there might be more
      hasMore = true;
    }

    // Check for NFTs missing metadata and trigger background fetch
    const nftsMissingMetadata = nfts.filter(nft => {
      // Check if NFT is missing essential metadata
      const hasTitle = nft.title && nft.title !== `NFT #${nft.token_id}` && nft.title !== `Token ${nft.token_id}`;
      const hasImage = nft.image_url && nft.image_url.trim() !== '';
      const hasMetadata = nft.metadata && nft.metadata !== 'null' && nft.metadata !== '{}';
      
      return !hasTitle || !hasImage || !hasMetadata;
    });

    if (nftsMissingMetadata.length > 0) {
      console.log(`🔍 [${requestId}] Found ${nftsMissingMetadata.length} NFTs missing metadata, triggering background fetch...`);
      
      const missingMetadataTokenIds = nftsMissingMetadata.map(nft => nft.token_id);
      console.log(`📋 [${requestId}] NFTs missing metadata:`, {
        count: missingMetadataTokenIds.length,
        tokenIds: missingMetadataTokenIds,
        details: nftsMissingMetadata.map(nft => ({
          token_id: nft.token_id,
          hasTitle: !!(nft.title && nft.title !== `NFT #${nft.token_id}` && nft.title !== `Token ${nft.token_id}`),
          hasImage: !!(nft.image_url && nft.image_url.trim() !== ''),
          hasMetadata: !!(nft.metadata && nft.metadata !== 'null' && nft.metadata !== '{}'),
          title: nft.title,
          image_url: nft.image_url,
        }))
      });

      // Trigger background metadata fetch for NFTs missing metadata
      setImmediate(async () => {
        try {
          console.log(`🔄 [${requestId}] Starting background metadata fetch for ${missingMetadataTokenIds.length} NFTs...`);
          await fetchAndStoreNFTMetadata(
            contractAddress,
            missingMetadataTokenIds,
            collection.id,
            { forceRefresh: true }
          );
          console.log(`✅ [${requestId}] Background metadata fetch completed for ${missingMetadataTokenIds.length} NFTs`);
        } catch (error) {
          console.error(`❌ [${requestId}] Background metadata fetch failed:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenIds: missingMetadataTokenIds,
          });
        }
      });
    }

    const response = {
      nfts,
      total: nfts.length, // Use actual NFT count
      hasMore,
      health: {
        status: health.health,
        reason: health.reason,
        nftCount: nfts.length,
        pageSize,
        expectedTotal: collection.total_supply,
        lastRefresh: collection.last_refresh_at,
        tokenType: collection.token_type,
      },
      raw: { nfts, total: nfts.length },
    };

    console.log(`📤 [${requestId}] Sending enhanced response:`, {
      nftCount: response.nfts.length,
      total: response.total,
      hasMore: response.hasMore,
      health: response.health,
      tokenType: collection.token_type,
      reason: hasMore ? 'next token exists or error occurred' : 'reached end of collection',
      raw: response,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error(`❌ [${requestId}] Error in getCollectionNFTs:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractAddress,
      page,
      pageSize,
      phase: 'getCollectionNFTs',
      raw: error, // Log the raw error for debugging
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFTs',
        details: error instanceof Error ? error.message : 'Error occurred while fetching existing NFTs',
        contractAddress,
        page,
        pageSize,
        raw: error, // Include raw error in response
      },
      { status: 500 }
    );
  }
} 