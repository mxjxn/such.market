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

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`📥 [${requestId}] NFT endpoint called:`, {
    contractAddress: params.contractAddress,
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
      const collection = await getCollectionByAddress(params.contractAddress);
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
        console.error(`❌ [${requestId}] Collection not found:`, params.contractAddress);
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        );
      }

      // Get existing NFTs with pagination
      console.log(`📦 [${requestId}] Fetching existing NFTs...`);
      try {
        const existingNFTs = await getCollectionNFTs(params.contractAddress, page, pageSize);
        console.log(`📊 [${requestId}] Existing NFTs query result:`, {
          collectionId: collection.id,
          count: existingNFTs?.nfts?.length ?? 0,
          total: existingNFTs?.total ?? 0,
          page,
          pageSize,
          hasMore: existingNFTs ? (page * pageSize + (existingNFTs.nfts?.length ?? 0) < (existingNFTs.total ?? 0)) : false,
          firstNFT: existingNFTs?.nfts?.[0] ? {
            tokenId: existingNFTs.nfts[0].token_id,
            title: existingNFTs.nfts[0].title,
            hasImage: !!existingNFTs.nfts[0].image_url,
            raw: existingNFTs.nfts[0], // Log the entire first NFT for debugging
          } : null,
          raw: existingNFTs, // Log the entire response for debugging
        });

        // If we have NFTs, return them
        if (existingNFTs?.nfts?.length > 0) {
          console.log(`✅ [${requestId}] Returning existing NFTs:`, {
            count: existingNFTs.nfts.length,
            firstNFT: existingNFTs.nfts[0] ? {
              tokenId: existingNFTs.nfts[0].token_id,
              title: existingNFTs.nfts[0].title,
              hasImage: !!existingNFTs.nfts[0].image_url,
              raw: existingNFTs.nfts[0], // Log the entire first NFT for debugging
            } : null,
          });

          const response = {
            nfts: existingNFTs.nfts,
            total: existingNFTs.total,
            hasMore: page * pageSize + existingNFTs.nfts.length < existingNFTs.total,
          };

          console.log(`📤 [${requestId}] Sending response:`, {
            nftCount: response.nfts.length,
            total: response.total,
            hasMore: response.hasMore,
            raw: response, // Log the entire response for debugging
          });

          return NextResponse.json(response);
        }

        // If no NFTs, fetch and store them
        console.log(`🔄 [${requestId}] No NFTs found, fetching from chain...`, {
          contractAddress: params.contractAddress,
          collectionId: collection.id,
          page,
          pageSize,
          tokenIds: Array.from({ length: pageSize }, (_, i) => String(page * pageSize + i + 1)),
        });

        try {
          const nfts = await fetchAndStoreNFTMetadata(
            params.contractAddress,
            Array.from({ length: pageSize }, (_, i) => String(page * pageSize + i + 1)),
            collection.id
          );

          console.log(`📝 [${requestId}] fetchAndStoreNFTMetadata result:`, {
            success: !!nfts,
            count: nfts?.length ?? 0,
            firstNFT: nfts?.[0] ? {
              tokenId: nfts[0].token_id,
              title: nfts[0].title,
              hasImage: !!nfts[0].image_url,
              raw: nfts[0], // Log the entire first NFT for debugging
            } : null,
            raw: nfts, // Log the entire response for debugging
          });

          // Check if we got any NFTs back
          if (!nfts || nfts.length === 0) {
            console.error(`❌ [${requestId}] No NFTs were fetched successfully:`, {
              contractAddress: params.contractAddress,
              collectionId: collection.id,
              page,
              pageSize,
              phase: 'fetchAndStoreNFTMetadata',
              raw: nfts, // Log the raw response for debugging
            });
            return NextResponse.json(
              { 
                error: 'Failed to fetch NFTs',
                details: 'No NFTs could be fetched from the contract. This could be due to invalid metadata or contract implementation.',
                contractAddress: params.contractAddress,
                page,
                pageSize,
                raw: nfts, // Include raw response in error
              },
              { status: 500 }
            );
          }

          const response = {
            nfts,
            total: collection.total_supply || nfts.length,
            hasMore: page * pageSize + nfts.length < (collection.total_supply || nfts.length),
          };

          console.log(`📤 [${requestId}] Sending response:`, {
            nftCount: response.nfts.length,
            total: response.total,
            hasMore: response.hasMore,
            raw: response, // Log the entire response for debugging
          });

          return NextResponse.json(response);
        } catch (error) {
          console.error(`❌ [${requestId}] Error fetching and storing NFTs:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            contractAddress: params.contractAddress,
            collectionId: collection.id,
            page,
            pageSize,
            phase: 'fetchAndStoreNFTMetadata',
            raw: error, // Log the raw error for debugging
          });
          return NextResponse.json(
            { 
              error: 'Failed to fetch NFTs',
              details: error instanceof Error ? error.message : 'Unknown error occurred while fetching NFTs',
              contractAddress: params.contractAddress,
              page,
              pageSize,
              raw: error, // Include raw error in response
            },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error in getCollectionNFTs:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          contractAddress: params.contractAddress,
          page,
          pageSize,
          phase: 'getCollectionNFTs',
          raw: error, // Log the raw error for debugging
        });
        return NextResponse.json(
          { 
            error: 'Failed to fetch NFTs',
            details: error instanceof Error ? error.message : 'Error occurred while fetching existing NFTs',
            contractAddress: params.contractAddress,
            page,
            pageSize,
            raw: error, // Include raw error in response
          },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error in getCollectionByAddress:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        contractAddress: params.contractAddress,
        phase: 'getCollectionByAddress',
        raw: error, // Log the raw error for debugging
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch NFTs',
          details: error instanceof Error ? error.message : 'Error occurred while fetching collection',
          contractAddress: params.contractAddress,
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
      contractAddress: params.contractAddress,
      page,
      pageSize,
      phase: 'main',
      raw: error, // Log the raw error for debugging
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFTs',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
        contractAddress: params.contractAddress,
        page,
        pageSize,
        raw: error, // Include raw error in response
      },
      { status: 500 }
    );
  }
} 