import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get('contractAddress');

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    if (!process.env.ALCHEMY_API_KEY) {
      return NextResponse.json(
        { error: 'Alchemy API key not configured' },
        { status: 500 }
      );
    }

    console.log(`📋 [FC Owners] Getting owners for contract ${contractAddress}`);

    // Call Alchemy's getOwnersForContract API
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getOwnersForContract`;
    const response = await fetch(`${alchemyUrl}?contractAddress=${contractAddress}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [FC Owners] Alchemy API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch owners from Alchemy' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.owners || !Array.isArray(data.owners)) {
      console.error(`❌ [FC Owners] Invalid response from Alchemy:`, data);
      return NextResponse.json(
        { error: 'Invalid response from Alchemy API' },
        { status: 500 }
      );
    }

    console.log(`✅ [FC Owners] Found ${data.owners.length} owners for ${contractAddress}`);
    
    return NextResponse.json({
      owners: data.owners,
      total: data.owners.length
    });

  } catch (error) {
    console.error('Error in FC owners endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 