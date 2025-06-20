import { NextRequest, NextResponse } from 'next/server';
import { Alchemy, Network } from 'alchemy-sdk';

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Simple in-memory rate limiter
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 second between requests

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
    const nftData = await alchemy.nft.getNftMetadata(contractAddress, tokenId);

    console.log('📝 Raw NFT Data Structure:', {
      tokenId,
      hasName: !!nftData.name,
      hasDescription: !!nftData.description,
      hasImage: !!nftData.image,
      hasRawMetadata: !!nftData.raw?.metadata,
      hasCollection: !!nftData.collection,
      keys: Object.keys(nftData),
    });

    // Extract metadata from the correct fields with proper type safety
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawMetadata = nftData.raw?.metadata as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageData = nftData.image as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionData = nftData.collection as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownersData = (nftData as any).owners;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaData = (nftData as any).media;

    const extractedMetadata = {
      name: nftData.name || rawMetadata?.name || `NFT #${tokenId}`,
      description: nftData.description || rawMetadata?.description || 'No description available',
      image: imageData?.cachedUrl || imageData?.originalUrl || rawMetadata?.image || null,
      thumbnail: imageData?.thumbnailUrl || imageData?.cachedUrl || imageData?.originalUrl || null,
      attributes: rawMetadata?.attributes || [],
      collection: collectionData?.name || null,
      owners: ownersData || [],
      media: mediaData || [],
    };

    console.log('✅ Extracted Metadata:', {
      tokenId,
      name: extractedMetadata.name,
      hasDescription: !!extractedMetadata.description,
      hasImage: !!extractedMetadata.image,
      hasThumbnail: !!extractedMetadata.thumbnail,
      attributeCount: extractedMetadata.attributes?.length || 0,
      hasCollection: !!extractedMetadata.collection,
      ownerCount: extractedMetadata.owners?.length || 0,
    });

    return NextResponse.json({
      ...nftData,
      metadata: extractedMetadata,
    });
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