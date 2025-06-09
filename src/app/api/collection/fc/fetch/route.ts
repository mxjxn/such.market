import { NextRequest, NextResponse } from 'next/server';
import { getCollectionByAddress } from '~/lib/db/collections';

export async function POST(request: NextRequest) {
  try {
    const { contractAddress } = await request.json();

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    console.log(`🔄 [FC Fetch] Starting background fetch for ${contractAddress}`);

    // Get collection from database
    const collection = await getCollectionByAddress(contractAddress.toLowerCase());
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Step 1: Get all owners from Alchemy
    console.log(`📋 [FC Fetch] Step 1: Getting owners for ${contractAddress}`);
    const ownersResponse = await fetch(
      `${request.nextUrl.origin}/api/collection/fc/owners?contractAddress=${contractAddress}`,
      { method: 'GET' }
    );

    if (!ownersResponse.ok) {
      throw new Error('Failed to get owners');
    }

    const { owners } = await ownersResponse.json();
    console.log(`✅ [FC Fetch] Found ${owners.length} owners for ${contractAddress}`);

    // Step 2: Get Farcaster users from these owners
    console.log(`👥 [FC Fetch] Step 2: Getting Farcaster users for ${owners.length} owners`);
    const fcUsersResponse = await fetch(
      `${request.nextUrl.origin}/api/collection/fc/users`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: owners }),
      }
    );

    if (!fcUsersResponse.ok) {
      throw new Error('Failed to get Farcaster users');
    }

    const { fcUsers } = await fcUsersResponse.json();
    console.log(`✅ [FC Fetch] Found ${fcUsers.length} Farcaster users`);

    // Step 3: Get NFTs for Farcaster users
    console.log(`🖼️ [FC Fetch] Step 3: Getting NFTs for ${fcUsers.length} Farcaster users`);
    const nftsResponse = await fetch(
      `${request.nextUrl.origin}/api/collection/fc/nfts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contractAddress,
          collectionId: collection.id,
          fcUsers 
        }),
      }
    );

    if (!nftsResponse.ok) {
      throw new Error('Failed to get NFTs');
    }

    const { nfts } = await nftsResponse.json();
    console.log(`✅ [FC Fetch] Successfully processed ${nfts.length} NFTs for ${contractAddress}`);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${nfts.length} NFTs for ${fcUsers.length} Farcaster users`,
      stats: {
        totalOwners: owners.length,
        fcUsers: fcUsers.length,
        nfts: nfts.length
      }
    });

  } catch (error) {
    console.error('Error in FC fetch endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 