import { NextRequest, NextResponse } from 'next/server';
import { Alchemy, Network, NftContract } from 'alchemy-sdk';

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Simple in-memory rate limiter
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 second between requests

// Extended NFT type to include metadata
interface NFTWithMetadata extends NftContract {
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string; tokenId: string } }
) {
  const { contractAddress, tokenId } = await Promise.resolve(params);

  console.log('🔍 NFT Metadata Request:', {
    contractAddress,
    tokenId,
  });

  try {
    // Validate inputs
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    // Check rate limit
    const lastRequestTime = rateLimiter.get(contractAddress) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      console.log(`⏳ Rate limiting request. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Update rate limiter
    rateLimiter.set(contractAddress, Date.now());

    // Fetch NFT metadata
    console.log('📡 Fetching NFT metadata from Alchemy:', { contractAddress, tokenId });
    const metadata = await alchemy.nft.getNftMetadata(contractAddress, tokenId) as NFTWithMetadata;

    console.log('✅ Metadata Response:', {
      tokenId,
      hasMetadata: !!metadata.metadata,
      hasImage: !!metadata.metadata?.image,
      hasName: !!metadata.metadata?.name,
    });

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('❌ Error fetching NFT metadata:', {
      error,
      contractAddress,
      tokenId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to fetch NFT metadata' },
      { status: 500 }
    );
  }
} 