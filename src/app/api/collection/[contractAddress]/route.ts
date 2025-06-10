import { NextRequest, NextResponse } from 'next/server';
import { getCollectionByAddress, fetchAndStoreCollectionMetadata } from '~/lib/db/collections';
import { getCachedCollection } from '~/lib/db/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  const { contractAddress } = await params;
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`🔍 [${requestId}] Collection endpoint called:`, {
    contractAddress,
    url: request.url,
    method: request.method,
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

    // Step 1: Try cache first
    console.log(`📦 [${requestId}] Checking cache...`);
    const cached = await getCachedCollection(contractAddress);
    if (cached) {
      console.log(`✅ [${requestId}] Cache hit for collection:`, contractAddress);
      return NextResponse.json(cached);
    }

    // Step 2: Try database
    console.log(`📦 [${requestId}] Checking database...`);
    let collection = await getCollectionByAddress(contractAddress);
    
    if (collection) {
      console.log(`✅ [${requestId}] Found collection in database:`, {
        id: collection.id,
        name: collection.name,
        tokenType: collection.token_type,
      });
      return NextResponse.json(collection);
    }

    // Step 3: Fall back to Alchemy/on-chain fetch
    console.log(`🔄 [${requestId}] Collection not found, fetching from Alchemy/on-chain...`);
    try {
      collection = await fetchAndStoreCollectionMetadata(contractAddress);
      
      if (collection) {
        console.log(`✅ [${requestId}] Successfully fetched and stored collection:`, {
          id: collection.id,
          name: collection.name,
          tokenType: collection.token_type,
        });
        return NextResponse.json(collection);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to fetch collection metadata:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractAddress,
      });
    }

    // Step 4: If all else fails, return 404
    console.log(`❌ [${requestId}] Collection not found anywhere:`, contractAddress);
    return NextResponse.json(
      { error: 'Collection not found' },
      { status: 404 }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Error in collection endpoint:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 