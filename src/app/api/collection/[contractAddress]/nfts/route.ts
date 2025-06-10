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

// Helper function to retry contract calls
async function retryContractCall<T>(
  address: Address,
  abi: typeof ERC721_METADATA_ABI,
  functionName: 'ownerOf',
  args: readonly [bigint],
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.readContract({
        address,
        abi,
        functionName,
        args,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  const { contractAddress } = await params;
  const requestId = Math.random().toString(36).substring(7);
  console.log(`📥 [${requestId}] NFT endpoint called:`, {
    contractAddress,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers.entries()),
  });

  // Get URL parameters
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '0', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

  console.log(`📊 [${requestId}] Request parameters:`, {
    page,
    pageSize,
    query: Object.fromEntries(url.searchParams.entries()),
  });

  try {
    // Get collection first to ensure it exists
    console.log(`🔍 [${requestId}] Fetching collection...`);
    try {
      const collection = await getCollectionByAddress(contractAddress);
      console.log(`📝 [${requestId}] Collection fetch result:`, {
        found: !!collection,
        id: collection?.id,
        name: collection?.name,
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
      });

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

      // Always check the next token on-chain to determine if we've reached the end
      try {
        const nextTokenId = (page + 1) * pageSize;
        
        // Try to get the owner of the next token
        try {
          await retryContractCall<Address>(
            contractAddress as Address,
            ERC721_METADATA_ABI,
            'ownerOf',
            [BigInt(nextTokenId)]
          );
          // If we get here, the token exists
          hasMore = true;
          console.log(`✅ [${requestId}] Next token ${nextTokenId} exists`);
        } catch (error) {
          // Check if the error indicates the token doesn't exist
          const errorMessage = error instanceof Error ? error.message : '';
          if (errorMessage.includes('execution reverted') || 
              errorMessage.includes('call revert exception') ||
              errorMessage.includes('ERC721: invalid token ID')) {
            // Token doesn't exist, we've reached the end
            hasMore = false;
            console.log(`🔚 [${requestId}] Reached end of collection at token ${nextTokenId}:`, {
              error: errorMessage,
              type: error instanceof Error ? error.name : typeof error,
            });
          } else {
            // Some other error, assume there might be more
            hasMore = true;
            console.log(`⚠️ [${requestId}] Error checking next token, assuming more exist:`, {
              error: errorMessage,
              type: error instanceof Error ? error.name : typeof error,
            });
          }
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error checking for more NFTs:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.name : typeof error,
        });
        // On error, assume there might be more
        hasMore = true;
      }

      const response = {
        nfts,
        total: nfts.length, // Use actual NFT count
        hasMore,
        raw: { nfts, total: nfts.length },
      };

      console.log(`📤 [${requestId}] Sending response:`, {
        nftCount: response.nfts.length,
        total: response.total,
        hasMore: response.hasMore,
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
  } catch (error) {
    console.error(`❌ [${requestId}] Error in NFT endpoint:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractAddress,
      page,
      pageSize,
      phase: 'main',
      raw: error, // Log the raw error for debugging
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFTs',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
        contractAddress,
        page,
        pageSize,
        raw: error, // Include raw error in response
      },
      { status: 500 }
    );
  }
} 