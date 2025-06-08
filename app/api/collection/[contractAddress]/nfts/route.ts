import { NextResponse } from 'next/server';
import { getCollectionByAddress } from '~/lib/db/collections';

export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string }> }
) {
  const { contractAddress } = await context.params;

  console.log('🚀 NFT endpoint called:', {
    contractAddress,
    url: request.url,
    method: request.method,
  });

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    console.log('📋 Request parameters:', {
      page,
      pageSize,
      forceRefresh,
      rawPage: url.searchParams.get('page'),
      rawPageSize: url.searchParams.get('pageSize'),
      rawForceRefresh: url.searchParams.get('forceRefresh'),
    });

    // Validate contract address
    if (!contractAddress) {
      console.error('❌ Missing contract address');
      return NextResponse.json(
        { error: 'Contract address is required' },
        { status: 400 }
      );
    }

    // Get collection from database
    console.log('🔍 Fetching collection:', contractAddress);
    const collection = await getCollectionByAddress(contractAddress);
    console.log('📦 Collection result:', {
      found: !!collection,
      id: collection?.id,
      name: collection?.name,
      totalSupply: collection?.total_supply,
      lastRefresh: collection?.last_refresh_at,
    });

    if (!collection) {
      console.error('❌ Collection not found:', contractAddress);
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // ... existing code ...
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
} 