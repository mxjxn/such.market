import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { 
  CACHE_KEYS, 
  REDIS_CONFIG,
  getCachedData,
  setCachedData
} from '~/lib/redis';

// Initialize viem client for on-chain calls
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// Cache key pattern
const OWNER_KEY = (contractAddress: string, tokenId: string) => 
  CACHE_KEYS.nftOwnership(contractAddress, tokenId);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string; tokenId: string }> }
) {
  try {
    const { contractAddress, tokenId } = await params;

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    if (!tokenId || !tokenId.match(/^\d+$/)) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    console.log(`🔍 [NFT Owner] Getting owner for ${contractAddress} #${tokenId}`);

    // Check cache first
    const cacheKey = OWNER_KEY(contractAddress, tokenId);
    const cachedOwner = await getCachedData<string>(cacheKey);
    
    if (cachedOwner) {
      console.log(`📦 [NFT Owner] Cache hit: ${cachedOwner}`);
      return NextResponse.json({
        contractAddress,
        tokenId,
        owner: cachedOwner,
        cached: true,
      });
    }

    console.log(`🔄 [NFT Owner] Cache miss, checking on-chain...`);

    // Try to get owner on-chain
    try {
      const owner = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      });

      if (owner) {
        console.log(`✅ [NFT Owner] On-chain owner: ${owner}`);
        
        // Cache the result
        await setCachedData(cacheKey, owner, REDIS_CONFIG.ttl.hot);
        
        return NextResponse.json({
          contractAddress,
          tokenId,
          owner,
          cached: false,
        });
      }
    } catch (error) {
      console.error(`❌ [NFT Owner] On-chain call failed:`, error);
    }

    // If we can't get the owner, return null
    console.log(`ℹ️ [NFT Owner] Could not determine owner`);
    return NextResponse.json({
      contractAddress,
      tokenId,
      owner: null,
      cached: false,
      error: 'Could not determine owner',
    });

  } catch (error) {
    console.error('❌ [NFT Owner] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 