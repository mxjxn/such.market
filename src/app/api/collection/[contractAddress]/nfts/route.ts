import { NextResponse } from 'next/server';
import { Alchemy, Network, Nft, GetNftsForContractOptions, NftContractForNft, NftTokenType, OpenSeaSafelistRequestStatus } from 'alchemy-sdk';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { getCollectionByAddress, getCollectionNFTs, upsertCollectionNFTs, updateCollectionRefreshTime } from '~/lib/db/collections';
import { getSupabaseClient } from '~/lib/supabase';
import { convertToOpenSeaMetadata, validateOpenSeaMetadata } from '~/lib/opensea-metadata';
import { getCachedCollectionNFTs, setCachedCollectionNFTs, invalidateCollectionCache } from '~/lib/db/cache';
import type { Database, Json } from '@/db/types/database.types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.resolve(process.cwd(), '.env.local');
  console.log('Loading env from:', envPath);
  dotenv.config({ path: envPath });
}

// Log environment variables (without sensitive values)
console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAlchemyKey: !!process.env.ALCHEMY_API_KEY,
  nodeEnv: process.env.NODE_ENV,
});

// Use the same NFT type as collections.ts
type NFT = Database['public']['Tables']['nfts']['Row'];

// Define NFTMetadata type based on our database schema
interface NFTMetadata {
  tokenId: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Json;
  attributes?: Json;
  media?: Json;
  collection_id?: string;
}

// Define the response type to match the collections implementation
type NFTResponse = {
  nfts: NFT[];
  total: number;
};

// Use getSupabaseClient() instead of supabase
const supabase = getSupabaseClient();

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Initialize viem client for on-chain calls
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// Add ERC721 and ERC1155 ABI items for metadata fetching
const ERC721_METADATA_ABI = [
  parseAbiItem('function tokenURI(uint256 tokenId) view returns (string)'),
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
];

const ERC1155_METADATA_ABI = [
  parseAbiItem('function uri(uint256 tokenId) view returns (string)'),
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
];

// Helper function to convert IPFS URLs to HTTPS URLs
function convertIpfsToHttps(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('ipfs://')) {
    const ipfsHash = url.replace('ipfs://', '');
    return `https://ipfs.infura.io/ipfs/${ipfsHash}`;
  }
  if (url.startsWith('/ipfs/')) {
    return `https://ipfs.infura.io${url}`;
  }
  return url;
}

// Helper function to fetch metadata from chain
async function fetchOnChainMetadata(contractAddress: string, tokenId: string): Promise<Partial<Nft> | null> {
  try {
    // Try ERC721 first
    try {
      const tokenURI = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: ERC721_METADATA_ABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });

      if (tokenURI) {
        const metadataUrl = convertIpfsToHttps(tokenURI);
        if (!metadataUrl) return null;

        const response = await fetch(metadataUrl);
        if (!response.ok) return null;

        const rawMetadata = await response.json();
        const imageUrl = convertIpfsToHttps(rawMetadata.image);
        
        // Convert to OpenSea metadata format
        const openSeaMetadata = convertToOpenSeaMetadata(rawMetadata);
        const validation = validateOpenSeaMetadata(openSeaMetadata);
        
        if (!validation.isValid) {
          console.warn('⚠️ Invalid OpenSea metadata:', {
            contractAddress,
            tokenId,
            errors: validation.errors,
          });
          return null; // Return null if metadata is invalid
        }
        
        const contract: NftContractForNft = {
          address: contractAddress,
          tokenType: NftTokenType.ERC721,
          spamClassifications: [],
          openSeaMetadata: {
            collectionName: openSeaMetadata.collection?.name || '',
            collectionSlug: openSeaMetadata.collection?.family || '',
            safelistRequestStatus: OpenSeaSafelistRequestStatus.NOT_REQUESTED,
            description: openSeaMetadata.description,
            externalUrl: openSeaMetadata.external_url,
            imageUrl: openSeaMetadata.image,
            lastIngestedAt: new Date().toISOString(),
          },
        };
        
        return {
          contract,
          tokenId,
          tokenType: NftTokenType.ERC721,
          raw: { metadata: rawMetadata },
          image: { originalUrl: imageUrl || undefined },
          timeLastUpdated: new Date().toISOString(),
        };
      }
    } catch (error) {
      // Not an ERC721, try ERC1155
      console.log('⚠️ ERC721 metadata fetch failed, trying ERC1155:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractAddress,
        tokenId,
      });
      try {
        const uri = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC1155_METADATA_ABI,
          functionName: 'uri',
          args: [BigInt(tokenId)],
        });

        if (uri) {
          const metadataUrl = convertIpfsToHttps(uri.replace('{id}', tokenId));
          if (!metadataUrl) return null;

          const response = await fetch(metadataUrl);
          if (!response.ok) return null;

          const rawMetadata = await response.json();
          const imageUrl = convertIpfsToHttps(rawMetadata.image);
          
          // Convert to OpenSea metadata format
          const openSeaMetadata = convertToOpenSeaMetadata(rawMetadata);
          const validation = validateOpenSeaMetadata(openSeaMetadata);
          
          if (!validation.isValid) {
            console.warn('⚠️ Invalid OpenSea metadata:', {
              contractAddress,
              tokenId,
              errors: validation.errors,
            });
            return null; // Return null if metadata is invalid
          }
          
          const contract: NftContractForNft = {
            address: contractAddress,
            tokenType: NftTokenType.ERC1155,
            spamClassifications: [],
            openSeaMetadata: {
              collectionName: openSeaMetadata.collection?.name || '',
              collectionSlug: openSeaMetadata.collection?.family || '',
              safelistRequestStatus: OpenSeaSafelistRequestStatus.NOT_REQUESTED,
              description: openSeaMetadata.description,
              externalUrl: openSeaMetadata.external_url,
              imageUrl: openSeaMetadata.image,
              lastIngestedAt: new Date().toISOString(),
            },
          };
          
          return {
            contract,
            tokenId,
            tokenType: NftTokenType.ERC1155,
            raw: { metadata: rawMetadata },
            image: { originalUrl: imageUrl || undefined },
            timeLastUpdated: new Date().toISOString(),
          };
        }
      } catch (e) {
        console.error('❌ Error fetching on-chain metadata:', {
          error: e instanceof Error ? e.message : 'Unknown error',
          contractAddress,
          tokenId,
        });
      }
    }
  } catch (error) {
    console.error('❌ Error in on-chain metadata fetch:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
      tokenId,
    });
  }
  return null;
}

// Helper function to fetch and store NFT metadata
async function fetchAndStoreNFTMetadata(
  contractAddress: string,
  tokenIds: string[],
  collectionId: string
): Promise<NFTMetadata[]> {
  console.log('🔄 Fetching metadata for tokens:', {
    contractAddress,
    tokenIds,
  });

  const nfts: Partial<Nft>[] = [];
  
  // Try Alchemy first
  try {
    const options: GetNftsForContractOptions = {
      pageSize: 100,
    };
    const response = await alchemy.nft.getNftsForContract(contractAddress, options);
    nfts.push(...response.nfts);
  } catch (error) {
    console.log('⚠️ Alchemy fetch failed, trying on-chain:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
    });
  }

  // For any missing NFTs, try on-chain
  const fetchedTokenIds = new Set(nfts.map(nft => nft.tokenId));
  const missingTokenIds = tokenIds.filter(id => !fetchedTokenIds.has(id));

  if (missingTokenIds.length > 0) {
    console.log('🔄 Fetching missing NFTs from chain:', {
      contractAddress,
      missingTokenIds,
    });

    for (const tokenId of missingTokenIds) {
      const nft = await fetchOnChainMetadata(contractAddress, tokenId);
      if (nft) {
        nfts.push(nft);
      }
    }
  }

  // Process and store NFTs
  const processedNfts: NFTMetadata[] = [];
  if (nfts.length > 0) {
    const nftsToStore = nfts.map(nft => ({
      tokenId: nft.tokenId!,
      title: nft.raw?.metadata?.name || `NFT #${nft.tokenId}`,
      description: nft.raw?.metadata?.description || null,
      imageUrl: nft.image?.originalUrl || nft.raw?.metadata?.image || null,
      thumbnailUrl: nft.image?.thumbnailUrl || null,
      metadata: nft.raw?.metadata || undefined,
      attributes: nft.raw?.metadata?.attributes || null,
      media: nft.raw?.metadata?.image ? [nft.raw?.metadata] : null,
      collection_id: collectionId,
    }));

    await upsertCollectionNFTs(collectionId, nftsToStore);
    processedNfts.push(...nftsToStore);
  }

  return processedNfts;
}

export async function GET(
  request: Request,
  context: { params: { contractAddress: string } }
) {
  try {
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
    const { contractAddress } = await context.params;
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

    // Check if collection needs refresh
    const needsRefresh = forceRefresh || !collection.last_refresh_at;
    console.log('🔄 Refresh check:', {
      needsRefresh,
      forceRefresh,
      lastRefresh: collection.last_refresh_at,
      cooldownUntil: collection.refresh_cooldown_until,
    });

    // Get NFTs from database
    console.log('📚 Fetching NFTs from database:', {
      contractAddress,
      page,
      pageSize,
    });
    const result = await getCollectionNFTs(contractAddress, page, pageSize);
    console.log('💾 Database NFT result:', {
      nftCount: result.nfts.length,
      total: result.total,
      firstNFT: result.nfts[0] ? {
        id: result.nfts[0].id,
        tokenId: result.nfts[0].token_id,
        title: result.nfts[0].title,
      } : null,
      lastNFT: result.nfts[result.nfts.length - 1] ? {
        id: result.nfts[result.nfts.length - 1].id,
        tokenId: result.nfts[result.nfts.length - 1].token_id,
        title: result.nfts[result.nfts.length - 1].title,
      } : null,
    });

    // If we have enough NFTs in the database and not forcing refresh, return them
    if (result.nfts.length === pageSize && !forceRefresh) {
      console.log('✅ Using database NFTs:', {
        contractAddress,
        page,
        pageSize,
        count: result.nfts.length,
        hasMore: page * pageSize + result.nfts.length < (collection.total_supply || result.total),
      });
      
      // Cache the results
      console.log('💾 Caching database NFTs');
      await setCachedCollectionNFTs(contractAddress, page, pageSize, result);
      
      return NextResponse.json({
        nfts: result.nfts,
        total: collection.total_supply || result.total,
        hasMore: page * pageSize + result.nfts.length < (collection.total_supply || result.total),
      });
    }

    // If we need to fetch more NFTs
    console.log('🔄 Need to fetch more NFTs:', {
      currentCount: result.nfts.length,
      pageSize,
      forceRefresh,
    });

    // Calculate which token IDs we need to fetch
    const existingTokenIds = new Set(result.nfts.map(nft => nft.token_id));
    const startTokenId = page * pageSize;
    const endTokenId = (page + 1) * pageSize - 1;
    const tokenIds = Array.from(
      { length: endTokenId - startTokenId + 1 },
      (_, i) => String(startTokenId + i)
    ).filter(id => !existingTokenIds.has(id));

    console.log('🎯 Token IDs to fetch:', {
      startTokenId,
      endTokenId,
      existingCount: existingTokenIds.size,
      toFetchCount: tokenIds.length,
      firstFew: tokenIds.slice(0, 5),
    });

    if (tokenIds.length === 0) {
      console.log('✨ All NFTs already in database');
      return NextResponse.json({
        nfts: result.nfts,
        total: collection.total_supply || result.total,
        hasMore: page * pageSize + result.nfts.length < (collection.total_supply || result.total),
      });
    }

    // Fetch and store metadata for missing NFTs
    console.log('🔍 Fetching metadata for missing NFTs');
    const fetchedNFTs = await fetchAndStoreNFTMetadata(contractAddress, tokenIds, collection.id);
    console.log('📦 Fetched NFT metadata:', {
      count: fetchedNFTs.length,
      firstNFT: fetchedNFTs[0] ? {
        tokenId: fetchedNFTs[0].tokenId,
        title: fetchedNFTs[0].title,
        hasImage: !!fetchedNFTs[0].imageUrl,
      } : null,
    });

    await updateCollectionRefreshTime(collection.id);
    console.log('⏰ Updated collection refresh time');

    const response: NFTResponse = {
      nfts: fetchedNFTs.map(nft => ({
        id: '', // This will be set by the database
        collection_id: collection.id,
        token_id: nft.tokenId,
        title: nft.title || null,
        description: nft.description || null,
        image_url: nft.imageUrl || null,
        thumbnail_url: nft.thumbnailUrl || null,
        metadata: nft.metadata || null,
        attributes: nft.attributes || null,
        media: nft.media || null,
        owner_address: null,
        last_owner_check_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      total: collection.total_supply || result.total,
    };

    console.log('📤 Prepared response:', {
      nftCount: response.nfts.length,
      total: response.total,
      firstNFT: response.nfts[0] ? {
        tokenId: response.nfts[0].token_id,
        title: response.nfts[0].title,
      } : null,
    });

    // Cache the results
    console.log('💾 Caching fetched NFTs');
    await setCachedCollectionNFTs(contractAddress, page, pageSize, response);

    // Invalidate collection cache to ensure fresh data
    console.log('🗑️ Invalidating collection cache');
    await invalidateCollectionCache(contractAddress);

    return NextResponse.json({
      nfts: response.nfts,
      total: response.total,
      hasMore: page * pageSize + response.nfts.length < response.total,
    });

  } catch (error) {
    const { contractAddress } = await context.params;
    console.error('❌ Error in NFT endpoint:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : 'Unknown error',
      contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
}

export { fetchAndStoreNFTMetadata, fetchOnChainMetadata }; 