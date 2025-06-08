import { NextResponse } from 'next/server';
import { Alchemy, Network } from 'alchemy-sdk';

// Initialize Alchemy SDK (server-side only)
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;
    
    if (!contractAddress) {
      return NextResponse.json(
        { error: 'Contract address is required' },
        { status: 400 }
      );
    }

    // Get contract metadata
    const metadata = await alchemy.nft.getContractMetadata(contractAddress);
    
    // Determine contract type based on metadata
    let contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN' = 'UNKNOWN';
    if (metadata.tokenType === 'ERC721') {
      contractType = 'ERC721';
    } else if (metadata.tokenType === 'ERC1155') {
      contractType = 'ERC1155';
    }

    return NextResponse.json({
      name: metadata.name ?? null,
      symbol: metadata.symbol ?? null,
      totalSupply: metadata.totalSupply ?? null,
      contractType,
    });
  } catch (error) {
    console.error('Error fetching contract metadata:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contract metadata' },
      { status: 500 }
    );
  }
} 