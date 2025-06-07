import { NextResponse } from 'next/server';
import { Alchemy, Network, Nft } from 'alchemy-sdk';
import { Redis } from '@upstash/redis';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

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

// Cache TTLs
const METADATA_CACHE_TTL = 86400; // 24 hours
const COLLECTION_INDEX_TTL = 3600; // 1 hour
const PAGE_CACHE_TTL = 900; // 15 minutes

// Cache key patterns
const METADATA_KEY = (contractAddress: string, tokenId: string) => 
  `nft:metadata:${contractAddress}:${tokenId}`;
const COLLECTION_INDEX_KEY = (contractAddress: string) => 
  `nft:collection:${contractAddress}:index`;
const PAGE_KEY = (contractAddress: string, pageNumber: number) => 
  `nft:collection:${contractAddress}:page:${pageNumber}`;

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

// Update NFTMetadata interface to match Redis data structure
interface NFTMetadata {
  tokenId: string;
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  media?: Array<{
    gateway: string | null;
    thumbnail: string | null;
    raw: string | null;
    format: string;
    bytes: number;
  }>;
  metadata?: {
    name: string;
    description: string;
    image: string | null;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  } | null;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Add interface for Redis data format
interface RedisNFTMetadata {
  tokenId: string;
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  metadata?: {
    name: string;
    description: string;
    image: string | null;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  } | null;
  media?: Array<{
    gateway: string | null;
    thumbnail: string | null;
    raw: string | null;
    format: string;
    bytes: number;
  }>;
}

// Update normalizeRedisMetadata to use the new type
function normalizeRedisMetadata(data: RedisNFTMetadata | null): NFTMetadata | null {
  if (!data) return null;

  // If it's already in the new format (from Alchemy/on-chain), return as is
  if (data.metadata || data.media) {
    return data as NFTMetadata;
  }

  // Convert old Redis format to new format
  const normalized: NFTMetadata = {
    tokenId: data.tokenId,
    title: data.title || `NFT #${data.tokenId}`,
    description: data.description || null,
    imageUrl: data.imageUrl || null,
    thumbnailUrl: data.thumbnailUrl || null,
    metadata: {
      name: data.title || `NFT #${data.tokenId}`,
      description: data.description || '',
      image: data.imageUrl || null,
      attributes: data.attributes || [],
    },
    attributes: data.attributes || [],
  };

  // Add media array if we have image URLs
  if (data.imageUrl) {
    normalized.media = [{
      gateway: data.imageUrl,
      thumbnail: data.thumbnailUrl || data.imageUrl,
      raw: data.imageUrl,
      format: 'image',
      bytes: 0,
    }];
  }

  return normalized;
}

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

// Add proper type for Alchemy NFT metadata
interface AlchemyNFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Update processAndStoreNFTMetadata with better logging and proper types
async function processAndStoreNFTMetadata(nft: Nft, contractAddress: string): Promise<NFTMetadata | null> {
  console.log('🔍 Processing NFT metadata:', {
    contractAddress,
    tokenId: nft.tokenId,
    rawMetadata: nft.raw?.metadata,
    media: (nft as any).media, // Log media for debugging
  });

  const rawMetadata = nft.raw?.metadata as AlchemyNFTMetadata | undefined;
  
  // Log all possible image sources
  const possibleImageUrls = {
    rawMetadataImage: rawMetadata?.image,
    mediaGateway: (nft as any).media?.[0]?.gateway,
    mediaThumbnail: (nft as any).media?.[0]?.thumbnail,
    rawUrl: (nft as any).media?.[0]?.raw,
  };
  console.log('🔍 Possible image URLs:', possibleImageUrls);

  const imageUrl = rawMetadata?.image 
    ? convertIpfsToHttps(rawMetadata.image)
    : (nft as any).media?.[0]?.gateway 
      ? convertIpfsToHttps((nft as any).media[0].gateway)
      : (nft as any).media?.[0]?.thumbnail 
        ? convertIpfsToHttps((nft as any).media[0].thumbnail)
        : null;

  console.log('🔍 Final image URL:', {
    contractAddress,
    tokenId: nft.tokenId,
    imageUrl,
    wasConverted: imageUrl !== rawMetadata?.image && imageUrl !== (nft as any).media?.[0]?.gateway,
  });

  if (!imageUrl) {
    console.log('⚠️ No image URL found for NFT:', {
      contractAddress,
      tokenId: nft.tokenId,
      rawMetadata: rawMetadata,
      media: (nft as any).media,
    });
    return null;
  }

  const metadata: NFTMetadata = {
    tokenId: nft.tokenId,
    title: (nft as any).title || rawMetadata?.name || `NFT #${nft.tokenId}`,
    description: (nft as any).description || rawMetadata?.description || null,
    media: ((nft as any).media || []).map((m: any) => ({
      gateway: convertIpfsToHttps(m.gateway),
      thumbnail: convertIpfsToHttps(m.thumbnail),
      raw: convertIpfsToHttps(m.raw),
      format: m.format || 'image',
      bytes: m.bytes || 0,
    })),
    metadata: {
      name: rawMetadata?.name || (nft as any).title || `NFT #${nft.tokenId}`,
      description: rawMetadata?.description || (nft as any).description || '',
      image: imageUrl,
      attributes: rawMetadata?.attributes || [],
    },
    attributes: rawMetadata?.attributes || [],
  };

  // Log the final metadata before storing
  console.log('📝 Storing NFT metadata:', {
    contractAddress,
    tokenId: nft.tokenId,
    hasImageUrl: !!metadata.imageUrl,
    hasMetadata: !!metadata.metadata,
    hasAttributes: !!metadata.attributes?.length,
    imageUrl: metadata.metadata?.image,
  });

  // Store metadata in Redis
  await redis.set(
    METADATA_KEY(contractAddress, nft.tokenId),
    metadata,
    { ex: METADATA_CACHE_TTL }
  );

  return metadata;
}

// Helper function to fetch metadata from chain
async function fetchOnChainMetadata(contractAddress: string, tokenId: string): Promise<NFTMetadata | null> {
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
        // Handle IPFS and HTTP URIs
        const metadataUrl = convertIpfsToHttps(tokenURI);
        if (!metadataUrl) return null;

        const response = await fetch(metadataUrl);
        if (!response.ok) return null;

        const rawMetadata = await response.json();
        const imageUrl = convertIpfsToHttps(rawMetadata.image);

        if (!imageUrl) return null;

        return {
          tokenId,
          title: rawMetadata.name || `NFT #${tokenId}`,
          description: rawMetadata.description || null,
          media: [{
            gateway: imageUrl,
            thumbnail: imageUrl,
            raw: metadataUrl,
            format: 'json',
            bytes: 0,
          }],
          metadata: {
            name: rawMetadata.name || `NFT #${tokenId}`,
            description: rawMetadata.description || '',
            image: imageUrl,
            attributes: rawMetadata.attributes || [],
          },
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
          // Handle IPFS and HTTP URIs
          const metadataUrl = convertIpfsToHttps(uri.replace('{id}', tokenId));
          if (!metadataUrl) return null;

          const response = await fetch(metadataUrl);
          if (!response.ok) return null;

          const rawMetadata = await response.json();
          const imageUrl = convertIpfsToHttps(rawMetadata.image);

          if (!imageUrl) return null;

          return {
            tokenId,
            title: rawMetadata.name || `NFT #${tokenId}`,
            description: rawMetadata.description || null,
            media: [{
              gateway: imageUrl,
              thumbnail: imageUrl,
              raw: metadataUrl,
              format: 'json',
              bytes: 0,
            }],
            metadata: {
              name: rawMetadata.name || `NFT #${tokenId}`,
              description: rawMetadata.description || '',
              image: imageUrl,
              attributes: rawMetadata.attributes || [],
            },
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

// Update getNFTMetadata with more detailed logging
async function getNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTMetadata | null> {
  // 1. Try Redis cache first
  const cached = await redis.get<RedisNFTMetadata>(METADATA_KEY(contractAddress, tokenId));
  if (cached) {
    console.log('📦 Found NFT metadata in Redis:', {
      contractAddress,
      tokenId,
      hasImageUrl: !!cached.imageUrl,
      hasMetadata: !!cached.metadata,
      hasAttributes: !!cached.attributes,
      imageUrl: cached.metadata?.image || cached.imageUrl,
      rawData: cached, // Log the full cached data
    });
    const normalized = normalizeRedisMetadata(cached);
    if (normalized) {
      return normalized;
    }
  }

  // 2. Try Alchemy if not in cache
  try {
    console.log('🔄 Fetching NFT metadata from Alchemy:', {
      contractAddress,
      tokenId,
    });
    const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
    console.log('📥 Raw Alchemy response:', {
      contractAddress,
      tokenId,
      hasRaw: !!nft.raw,
      rawMetadata: nft.raw?.metadata,
      media: (nft as any).media,
    });
    
    const metadata = await processAndStoreNFTMetadata(nft, contractAddress);
    if (metadata) {
      return metadata;
    }
  } catch (error) {
    console.log('⚠️ Alchemy metadata fetch failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
      tokenId,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  // 3. Try on-chain as last resort
  console.log('🔄 Fetching NFT metadata from chain:', {
    contractAddress,
    tokenId,
  });
  const onChainMetadata = await fetchOnChainMetadata(contractAddress, tokenId);
  if (onChainMetadata) {
    // Store successful on-chain metadata in Redis
    await redis.set(
      METADATA_KEY(contractAddress, tokenId),
      onChainMetadata,
      { ex: METADATA_CACHE_TTL }
    );
    return onChainMetadata;
  }

  console.log('❌ Failed to fetch NFT metadata from all sources:', {
    contractAddress,
    tokenId,
  });
  return null;
}

// Helper function to update collection index
async function updateCollectionIndex(contractAddress: string, tokenIds: string[]): Promise<void> {
  await redis.set(
    COLLECTION_INDEX_KEY(contractAddress),
    tokenIds,
    { ex: COLLECTION_INDEX_TTL }
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get('pageKey') || undefined;
    const forceRefresh = searchParams.get('refresh') === 'true'; // Add force refresh parameter
    const pageSize = 20;
    const { contractAddress } = await context.params;

    // Get or fetch collection index
    let tokenIds = await redis.get<string[]>(COLLECTION_INDEX_KEY(contractAddress));
    const needsIndexUpdate = !tokenIds;

    if (!tokenIds) {
      console.log('🔄 Fetching collection index from Alchemy:', { contractAddress });
      const response = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: 100, // Get more tokens to build initial index
      });
      tokenIds = response.nfts.map(nft => nft.tokenId);
      await updateCollectionIndex(contractAddress, tokenIds);
    }

    // Calculate page number and get cached page if available
    const pageNumber = pageKey ? parseInt(pageKey) : 0;
    const pageStart = pageNumber * pageSize;
    const pageEnd = pageStart + pageSize;
    const pageTokenIds = tokenIds.slice(pageStart, pageEnd);

    // Try to get cached page data
    const cachedPage = forceRefresh ? null : await redis.get<{ tokenIds: string[], metadata: NFTMetadata[] }>(
      PAGE_KEY(contractAddress, pageNumber)
    );

    if (cachedPage?.metadata?.length === pageTokenIds.length) {
      console.log('📦 Serving page from cache:', {
        contractAddress,
        pageNumber,
        nftCount: cachedPage.metadata.length,
        firstNFT: cachedPage.metadata[0] ? {
          tokenId: cachedPage.metadata[0].tokenId,
          hasImageUrl: !!cachedPage.metadata[0].metadata?.image,
          imageUrl: cachedPage.metadata[0].metadata?.image,
          hasMetadata: !!cachedPage.metadata[0].metadata,
          hasAttributes: !!cachedPage.metadata[0].attributes?.length,
        } : null,
        lastNFT: cachedPage.metadata[cachedPage.metadata.length - 1] ? {
          tokenId: cachedPage.metadata[cachedPage.metadata.length - 1].tokenId,
          hasImageUrl: !!cachedPage.metadata[cachedPage.metadata.length - 1].metadata?.image,
          imageUrl: cachedPage.metadata[cachedPage.metadata.length - 1].metadata?.image,
          hasMetadata: !!cachedPage.metadata[cachedPage.metadata.length - 1].metadata,
          hasAttributes: !!cachedPage.metadata[cachedPage.metadata.length - 1].attributes?.length,
        } : null,
      });

      // If we have cached data but it's missing images, force a refresh
      const hasMissingImages = cachedPage.metadata.some(nft => !nft.metadata?.image);
      if (hasMissingImages) {
        console.log('⚠️ Cached data has missing images, forcing refresh');
        // Delete the cached page to force a refresh
        await redis.del(PAGE_KEY(contractAddress, pageNumber));
      } else {
        return NextResponse.json({
          nfts: cachedPage.metadata,
          pageKey: pageNumber + 1 < Math.ceil(tokenIds.length / pageSize) ? (pageNumber + 1).toString() : undefined,
        });
      }
    }

    // Fetch metadata for page tokens
    console.log('🔄 Fetching metadata for page:', {
      contractAddress,
      pageNumber,
      tokenIds: pageTokenIds,
      forceRefresh,
    });

    const metadataPromises = pageTokenIds.map(tokenId => 
      getNFTMetadata(contractAddress, tokenId)
    );
    const metadataResults = await Promise.all(metadataPromises);
    const validMetadata = metadataResults.filter((m): m is NFTMetadata => m !== null);

    // Log the results of our fetch
    console.log('📊 Page fetch results:', {
      contractAddress,
      pageNumber,
      expectedCount: pageTokenIds.length,
      actualCount: validMetadata.length,
      hasMissingImages: validMetadata.some(nft => !nft.metadata?.image),
      firstNFT: validMetadata[0] ? {
        tokenId: validMetadata[0].tokenId,
        hasImageUrl: !!validMetadata[0].metadata?.image,
        imageUrl: validMetadata[0].metadata?.image,
      } : null,
    });

    // Cache the page
    if (validMetadata.length > 0) {
      await redis.set(
        PAGE_KEY(contractAddress, pageNumber),
        { tokenIds: pageTokenIds, metadata: validMetadata },
        { ex: PAGE_CACHE_TTL }
      );
    }

    // If we got fewer NFTs than expected, update the collection index
    if (needsIndexUpdate || validMetadata.length < pageTokenIds.length) {
      console.log('🔄 Updating collection index:', {
        contractAddress,
        expected: pageTokenIds.length,
        received: validMetadata.length,
      });
      const response = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: 100,
      });
      const newTokenIds = response.nfts.map(nft => nft.tokenId);
      await updateCollectionIndex(contractAddress, newTokenIds);
    }

    return NextResponse.json({
      nfts: validMetadata,
      pageKey: pageNumber + 1 < Math.ceil(tokenIds.length / pageSize) ? (pageNumber + 1).toString() : undefined,
    });
  } catch (error) {
    const { contractAddress } = await context.params;
    console.error('❌ Error in NFT endpoint:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to fetch NFTs' },
      { status: 500 }
    );
  }
} 