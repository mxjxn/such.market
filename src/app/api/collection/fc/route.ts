import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { getCollectionByAddress } from '~/lib/db/collections';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Validate contract address
    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    console.log(`🔄 [FC Collection] Starting fetch for ${contractAddress}, page ${page}, size ${pageSize}`);

    // Check if collection exists in database
    const collection = await getCollectionByAddress(contractAddress.toLowerCase());
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Check if we have recent data (less than 24 hours old)
    const supabase = getSupabaseClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNFTs, error: recentError } = await supabase
      .from('nfts')
      .select('*')
      .eq('collection_id', collection.id)
      .not('owner_address', 'is', null)
      .gte('last_owner_check_at', twentyFourHoursAgo)
      .order('token_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (recentError) {
      console.error('Error fetching recent NFTs:', recentError);
      return NextResponse.json(
        { error: 'Failed to fetch recent NFTs' },
        { status: 500 }
      );
    }

    // If we have recent data, return it
    if (recentNFTs && recentNFTs.length > 0) {
      console.log(`✅ [FC Collection] Returning ${recentNFTs.length} recent NFTs for ${contractAddress}`);
      return NextResponse.json({
        nfts: recentNFTs,
        total: recentNFTs.length,
        page,
        pageSize,
        isFresh: true
      });
    }

    // If no recent data, trigger the full fetch process
    console.log(`🔄 [FC Collection] No recent data found, triggering full fetch for ${contractAddress}`);
    
    // Start the background fetch process
    const fetchPromise = fetch(`${request.nextUrl.origin}/api/collection/fc/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contractAddress }),
    });

    // Don't wait for the fetch to complete, return empty result immediately
    fetchPromise.catch(error => {
      console.error('Error starting background fetch:', error);
    });

    return NextResponse.json({
      nfts: [],
      total: 0,
      page,
      pageSize,
      isFresh: false,
      message: 'Fetching fresh data in background'
    });

  } catch (error) {
    console.error('Error in FC collection endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 