import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { 
  CACHE_KEYS, 
  REDIS_CONFIG,
  getCachedData,
  setCachedData
} from '~/lib/redis';
import { getCollectionByAddress } from '~/lib/db/collections';

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
    const cachedData = await getCachedData<{ owner: string | null; tokenType: string | null; balance?: number | null }>(cacheKey);
    
    if (cachedData) {
      console.log(`📦 [NFT Owner] Cache hit: ${cachedData.owner}`);
      return NextResponse.json({
        contractAddress,
        tokenId,
        owner: cachedData.owner,
        tokenType: cachedData.tokenType,
        balance: cachedData.balance,
        cached: true,
      });
    }

    console.log(`🔄 [NFT Owner] Cache miss, checking on-chain...`);

    // Get collection info to determine token type
    const collection = await getCollectionByAddress(contractAddress);
    const tokenType = collection?.token_type;
    
    console.log(`📋 [NFT Owner] Collection token type: ${tokenType || 'unknown'}`);

    // Try to get owner based on token type
    let owner: string | null = null;
    let detectedTokenType = tokenType;
    const balance: number | null = null;

    if (tokenType === 'ERC721' || !tokenType) {
      // Try ERC-721 ownerOf first
      try {
        owner = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        });

        if (owner) {
          console.log(`✅ [NFT Owner] ERC-721 owner: ${owner}`);
          detectedTokenType = 'ERC721';
        }
      } catch (error) {
        console.log(`⚠️ [NFT Owner] ERC-721 ownerOf failed, trying ERC-1155:`, error);
        
        // If ownerOf fails, try ERC-1155 balanceOf
        try {
          // For ERC-1155, we need to check multiple addresses to find the owner
          // This is a simplified approach - in practice you might want to use events or other methods
          await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
            functionName: 'balanceOf',
            args: ['0x0000000000000000000000000000000000000000', BigInt(tokenId)],
          });

          // If we can call balanceOf successfully, it's likely ERC-1155
          console.log(`✅ [NFT Owner] ERC-1155 balanceOf call successful`);
          detectedTokenType = 'ERC1155';
          
          // For ERC-1155, we can't easily determine the owner from on-chain calls alone
          // You would typically need to use events or other indexing methods
          // For now, we'll return null and let the caller handle it
          owner = null;
        } catch (erc1155Error) {
          console.log(`❌ [NFT Owner] ERC-1155 balanceOf also failed:`, erc1155Error);
          detectedTokenType = 'ERC1155'; // Assume ERC-1155 if both fail
        }
      }
    } else if (tokenType === 'ERC1155') {
      // Known ERC-1155 contract
      try {
        await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
          functionName: 'balanceOf',
          args: ['0x0000000000000000000000000000000000000000', BigInt(tokenId)],
        });

        console.log(`✅ [NFT Owner] ERC-1155 balanceOf call successful`);
        // For ERC-1155, we can't easily determine the owner from on-chain calls alone
        owner = null;
      } catch (error) {
        console.error(`❌ [NFT Owner] ERC-1155 balanceOf failed:`, error);
        owner = null;
      }
    }

    // Cache the result (even if null, to avoid repeated failed calls)
    const cacheData = {
      owner,
      tokenType: detectedTokenType,
      balance,
    };
    
    if (owner) {
      await setCachedData(cacheKey, cacheData, REDIS_CONFIG.ttl.hot);
    } else {
      // Cache null result for a shorter time to avoid repeated failed calls
      await setCachedData(cacheKey, cacheData, REDIS_CONFIG.ttl.cold);
    }

    return NextResponse.json({
      contractAddress,
      tokenId,
      owner,
      tokenType: detectedTokenType,
      balance,
      cached: false,
      error: owner ? null : 'Could not determine owner',
    });

  } catch (error) {
    console.error('❌ [NFT Owner] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 