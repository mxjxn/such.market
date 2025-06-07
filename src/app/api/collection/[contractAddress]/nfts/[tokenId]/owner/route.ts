import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Initialize viem client for on-chain calls
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// Cache TTL - 15 minutes in seconds
const OWNER_CACHE_TTL = 900;

// Cache key pattern
const OWNER_KEY = (contractAddress: string, tokenId: string) => 
  `nft:owner:${contractAddress}:${tokenId}`;

// ERC721 ABI for ownerOf function
const ERC721_OWNER_ABI = [
  parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)'),
];

async function getNFTOwner(contractAddress: string, tokenId: string): Promise<string | null> {
  try {
    // Try to get from cache first
    const cachedOwner = await redis.get<string>(OWNER_KEY(contractAddress, tokenId));
    if (cachedOwner) {
      console.log('📦 Found NFT owner in cache:', {
        contractAddress,
        tokenId,
        owner: cachedOwner,
      });
      return cachedOwner;
    }

    // Check if we've previously determined this NFT is not transferable
    const notTransferableKey = `nft:not_transferable:${contractAddress}:${tokenId}`;
    const isNotTransferable = await redis.get<boolean>(notTransferableKey);
    if (isNotTransferable) {
      console.log('📦 NFT marked as not transferable:', {
        contractAddress,
        tokenId,
      });
      return null;
    }

    // Fetch from chain if not in cache
    console.log('🔄 Fetching NFT owner from chain:', {
      contractAddress,
      tokenId,
    });

    try {
      const owner = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ERC721_OWNER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      });

      if (owner) {
        // Cache the result
        await redis.set(
          OWNER_KEY(contractAddress, tokenId),
          owner,
          { ex: OWNER_CACHE_TTL }
        );

        console.log('✅ Successfully fetched and cached NFT owner:', {
          contractAddress,
          tokenId,
          owner,
        });

        return owner;
      }
    } catch (error) {
      // If we get a specific error indicating the token doesn't exist or isn't transferable,
      // cache that information to prevent repeated attempts
      if (error instanceof Error && 
          (error.message.includes('execution reverted') || 
           error.message.includes('call revert exception'))) {
        console.log('ℹ️ NFT appears to be not transferable:', {
          contractAddress,
          tokenId,
          error: error.message,
        });
        
        // Cache the not transferable status for a longer time
        await redis.set(
          notTransferableKey,
          true,
          { ex: OWNER_CACHE_TTL * 2 } // Cache for twice as long as owner data
        );
      }
      throw error; // Re-throw to be caught by outer try-catch
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching NFT owner:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
      tokenId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string; tokenId: string }> }
) {
  try {
    const { contractAddress, tokenId } = await context.params;
    
    // Validate inputs
    if (!contractAddress || !tokenId) {
      return NextResponse.json(
        { error: 'Contract address and token ID are required' },
        { status: 400 }
      );
    }

    const owner = await getNFTOwner(contractAddress, tokenId);

    // Return 200 with null owner for non-transferable NFTs
    // This is better than 404 as it indicates the request was successful
    // but the NFT is not transferable
    return NextResponse.json({ 
      owner,
      transferable: owner !== null 
    });
  } catch (error) {
    console.error('❌ Error in NFT owner endpoint:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 