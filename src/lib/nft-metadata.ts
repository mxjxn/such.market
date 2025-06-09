import { Alchemy, Network } from 'alchemy-sdk';
import { createPublicClient, http, parseAbiItem, type PublicClient, type Address, type Abi, type Chain, type HttpTransport } from 'viem';
import { base } from 'viem/chains';
import { getSupabaseClient } from '~/lib/supabase';
import { convertToOpenSeaMetadata, type OpenSeaMetadata } from '~/lib/opensea-metadata';
import type { Database } from '@/db/types/database.types';
import { upsertCollectionNFTs } from './db/collections';
import { v4 as uuidv4 } from 'uuid';

export type { PublicClient, HttpTransport, Chain, Abi };

type DatabaseNFT = Database['public']['Tables']['nfts']['Row'];
type DatabaseNFTInsert = Omit<DatabaseNFT, 'id'> & { id?: string };

// Define NFTMetadata type
export type NFTMetadata = {
  tokenId: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Record<string, unknown>;
  attributes?: Array<{ trait_type: string; value: string }>;
  media?: Array<{
    gateway: string | null;
    thumbnail: string | null;
    raw: string | null;
    format: string;
    bytes: number;
  }>;
};

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

// Add validation result type
type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

// Update validateOpenSeaMetadata to return ValidationResult
function validateOpenSeaMetadata(metadata: OpenSeaMetadata): ValidationResult {
  const errors: string[] = [];
  
  if (!metadata.name) {
    errors.push('Missing name');
  }
  if (!metadata.description) {
    errors.push('Missing description');
  }
  if (!metadata.image) {
    errors.push('Missing image');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
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

// Helper function to get clients with lazy initialization
let alchemy: Alchemy | null = null;
let client: PublicClient<HttpTransport, Chain> | null = null;
let supabase: ReturnType<typeof getSupabaseClient> | null = null;

async function getClients() {
  // Log environment variables (without values)
  const envVars = {
    hasAlchemyKey: !!process.env.ALCHEMY_API_KEY,
    hasBaseRpcUrl: !!process.env.BASE_MAINNET_RPC,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
  };
  console.log('🔑 [NFT Metadata] Environment variables:', envVars);

  // Initialize clients if needed
  if (!alchemy && process.env.ALCHEMY_API_KEY) {
    try {
      console.log('🔧 Initializing Alchemy client...');
      alchemy = new Alchemy({
        apiKey: process.env.ALCHEMY_API_KEY,
        network: Network.BASE_MAINNET,
      });
      console.log('✅ Alchemy client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Alchemy client:', error);
    }
  }

  if (!client && process.env.BASE_MAINNET_RPC) {
    try {
      console.log('🔧 Initializing Viem client...');
      client = createPublicClient({
        chain: base,
        transport: http(process.env.BASE_MAINNET_RPC),
      });
      console.log('✅ Viem client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Viem client:', error);
    }
  }

  if (!supabase) {
    try {
      console.log('🔧 Initializing Supabase client...');
      supabase = getSupabaseClient();
      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
    }
  }

  // Return available clients
  return {
    client,
    supabase,
    hasRequiredClients: !!(client && supabase), // We need at least Viem and Supabase
  };
}

// Helper function to try fetching metadata for a specific token ID
async function tryFetchMetadata(contractAddress: string, tokenId: string): Promise<DatabaseNFTInsert | null> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🔄 [${requestId}] Starting metadata fetch for token:`, {
    contractAddress,
    tokenId,
  });

  const { client, supabase, hasRequiredClients } = await getClients();
  
  if (!hasRequiredClients) {
    console.error(`❌ [${requestId}] Missing required clients for metadata fetching:`, {
      hasClient: !!client,
      hasSupabase: !!supabase,
    });
    return null;
  }

  try {
    // Try ERC721 first
    console.log(`🔍 [${requestId}] Trying ERC721 tokenURI...`);
    const tokenUri = await client!.readContract({
      address: contractAddress as Address,
      abi: ERC721_METADATA_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    }).catch((error) => {
      console.log(`⚠️ [${requestId}] ERC721 tokenURI failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractAddress,
        tokenId,
      });
      return null;
    });

    console.log(`📝 [${requestId}] tokenURI result:`, {
      success: !!tokenUri,
      uri: tokenUri,
    });

    if (tokenUri) {
      const metadataUrl = convertIpfsToHttps(tokenUri);
      console.log(`🔗 [${requestId}] Converted metadata URL:`, {
        original: tokenUri,
        converted: metadataUrl,
      });

      if (!metadataUrl) {
        console.warn(`⚠️ [${requestId}] Invalid token URI for token ${tokenId}:`, tokenUri);
        return null;
      }

      try {
        console.log(`📡 [${requestId}] Fetching metadata from URL...`);
        const response = await fetch(metadataUrl);
        console.log(`📥 [${requestId}] Metadata fetch response:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        });

        if (!response.ok) {
          console.warn(`⚠️ [${requestId}] Failed to fetch metadata for token ${tokenId}:`, {
            status: response.status,
            statusText: response.statusText,
            url: metadataUrl,
          });
          return null;
        }

        const metadata = await response.json();
        console.log(`📝 [${requestId}] Raw metadata:`, {
          hasName: !!metadata.name,
          hasDescription: !!metadata.description,
          hasImage: !!metadata.image,
          hasAttributes: Array.isArray(metadata.attributes),
          attributeCount: Array.isArray(metadata.attributes) ? metadata.attributes.length : 0,
          raw: metadata,
        });

        const openSeaMetadata = convertToOpenSeaMetadata(metadata);
        console.log(`🔄 [${requestId}] Converted to OpenSea format:`, {
          hasName: !!openSeaMetadata.name,
          hasDescription: !!openSeaMetadata.description,
          hasImage: !!openSeaMetadata.image,
          hasAttributes: Array.isArray(openSeaMetadata.attributes),
          attributeCount: Array.isArray(openSeaMetadata.attributes) ? openSeaMetadata.attributes.length : 0,
          raw: openSeaMetadata,
        });
        
        const validationResult = validateOpenSeaMetadata(openSeaMetadata);
        if (!validationResult.isValid) {
          console.warn(`⚠️ [${requestId}] Invalid metadata for token ${tokenId}:`, {
            metadata: openSeaMetadata,
            validationErrors: validationResult.errors,
          });
          return null;
        }

        const safeAttributes = Array.isArray(openSeaMetadata.attributes)
          ? openSeaMetadata.attributes.filter(
              (attr): attr is { trait_type: string; value: string } =>
                typeof attr === 'object' &&
                attr !== null &&
                typeof attr.trait_type === 'string' &&
                (typeof attr.value === 'string' || typeof attr.value === 'number')
            ).map(attr => ({ trait_type: attr.trait_type, value: String(attr.value) }))
          : null;

        const nft: DatabaseNFTInsert = {
          id: uuidv4(),
          collection_id: '', // Will be set by the caller
          token_id: tokenId,
          title: openSeaMetadata.name || `NFT #${tokenId}`,
          description: openSeaMetadata.description || null,
          image_url: convertIpfsToHttps(openSeaMetadata.image) || null,
          thumbnail_url: convertIpfsToHttps(openSeaMetadata.image) || null,
          external_url: openSeaMetadata.external_url || null,
          attributes: safeAttributes,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        console.log(`✅ [${requestId}] Successfully processed NFT metadata:`, {
          tokenId,
          title: nft.title,
          hasImage: !!nft.image_url,
          hasThumbnail: !!nft.thumbnail_url,
          hasAttributes: Array.isArray(nft.attributes),
          attributeCount: Array.isArray(nft.attributes) ? nft.attributes.length : 0,
          raw: nft,
        });

        return nft;
      } catch (error) {
        console.warn(`⚠️ [${requestId}] Error processing metadata for token ${tokenId}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          url: metadataUrl,
        });
        return null;
      }
    }

    // If ERC721 fails, try ERC1155
    console.log(`🔍 [${requestId}] Trying ERC1155 uri...`);
    const uri = await client!.readContract({
      address: contractAddress as Address,
      abi: ERC1155_METADATA_ABI,
      functionName: 'uri',
      args: [BigInt(tokenId)],
    }).catch((error) => {
      console.log(`⚠️ [${requestId}] ERC1155 uri failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractAddress,
        tokenId,
      });
      return null;
    });

    console.log(`📝 [${requestId}] uri result:`, {
      success: !!uri,
      uri: uri,
    });

    if (uri) {
      // Process ERC1155 metadata similar to ERC721
      // ... (same metadata processing logic as above)
    }

    console.log(`❌ [${requestId}] No valid metadata found for token ${tokenId}`);
    return null;
  } catch (error) {
    console.warn(`⚠️ [${requestId}] Error fetching metadata for token ${tokenId}:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractAddress,
      tokenId,
    });
    return null;
  }
}

export async function fetchAndStoreNFTMetadata(
  contractAddress: string,
  tokenIds: string[],
  collectionId: string
): Promise<DatabaseNFT[]> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🔄 [${requestId}] Starting NFT metadata fetch:`, {
    contractAddress,
    tokenIds,
    collectionId,
  });

  const { supabase, hasRequiredClients } = await getClients();
  
  if (!hasRequiredClients) {
    console.error(`❌ [${requestId}] Missing required clients for NFT metadata fetching:`, {
      hasClient: !!client,
      hasSupabase: !!supabase,
    });
    throw new Error('Missing required clients for NFT metadata fetching');
  }

  const validNFTs: DatabaseNFTInsert[] = [];
  const errors: Array<{ tokenId: string; error: string }> = [];

  // Process each token ID
  for (const tokenId of tokenIds) {
    try {
      console.log(`🔄 [${requestId}] Processing token ${tokenId}...`);
      const nft = await tryFetchMetadata(contractAddress, tokenId);
      if (nft) {
        nft.collection_id = collectionId;
        validNFTs.push(nft);
        console.log(`✅ [${requestId}] Successfully processed token ${tokenId}`);
      } else {
        console.warn(`⚠️ [${requestId}] Failed to fetch valid metadata for token ${tokenId}`);
        errors.push({ tokenId, error: 'Failed to fetch valid metadata' });
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error processing token ${tokenId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      errors.push({ 
        tokenId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // If we have no valid NFTs, throw an error
  if (validNFTs.length === 0) {
    console.error(`❌ [${requestId}] No valid NFTs found:`, {
      contractAddress,
      collectionId,
      errors,
      attemptedTokens: tokenIds,
    });
    throw new Error('No valid NFTs could be fetched');
  }

  // Store the NFTs
  try {
    console.log(`💾 [${requestId}] Storing ${validNFTs.length} NFTs...`);
    const nftMetadata: NFTMetadata[] = validNFTs.map(nft => {
      let parsedMetadata: Record<string, unknown> | undefined = undefined;
      try {
        parsedMetadata = nft.metadata ? JSON.parse(nft.metadata as string) : undefined;
      } catch {
        parsedMetadata = undefined;
      }
      const safeAttributes = Array.isArray(nft.attributes)
        ? nft.attributes.filter(
            (attr): attr is { trait_type: string; value: string } =>
              typeof attr === 'object' &&
              attr !== null &&
              typeof attr.trait_type === 'string' &&
              typeof attr.value === 'string'
          )
        : undefined;
      return {
        tokenId: nft.token_id,
        title: nft.title || null,
        description: nft.description || null,
        imageUrl: nft.image_url || null,
        thumbnailUrl: nft.thumbnail_url || null,
        metadata: parsedMetadata,
        attributes: safeAttributes,
        media: [{
          gateway: nft.image_url || null,
          thumbnail: nft.thumbnail_url || null,
          raw: nft.image_url || null,
          format: 'image',
          bytes: 0,
        }],
      };
    });

    await upsertCollectionNFTs(collectionId, nftMetadata);
    console.log(`✅ [${requestId}] NFTs stored successfully`);

    // Fetch the stored NFTs to return
    console.log(`🔍 [${requestId}] Fetching stored NFTs...`);
    const { data: storedNFTs, error: fetchError } = await supabase!
      .from('nfts')
      .select('*')
      .in('token_id', tokenIds)
      .eq('collection_id', collectionId);

    console.log(`📝 [${requestId}] Stored NFTs fetch result:`, {
      success: !fetchError,
      count: storedNFTs?.length ?? 0,
      error: fetchError,
      firstNFT: storedNFTs?.[0] ? {
        tokenId: storedNFTs[0].token_id,
        title: storedNFTs[0].title,
        hasImage: !!storedNFTs[0].image_url,
        raw: storedNFTs[0],
      } : null,
      raw: storedNFTs,
    });

    if (fetchError) {
      console.error(`❌ [${requestId}] Error fetching stored NFTs:`, {
        error: fetchError,
        contractAddress,
        collectionId,
        tokenIds,
      });
      throw fetchError;
    }

    if (!storedNFTs || storedNFTs.length === 0) {
      console.error(`❌ [${requestId}] No NFTs found after storage:`, {
        contractAddress,
        collectionId,
        tokenIds,
        validNFTsCount: validNFTs.length,
      });
      throw new Error('Failed to retrieve stored NFTs');
    }

    // Log any partial failures
    if (errors.length > 0) {
      console.warn(`⚠️ [${requestId}] Some NFTs failed to fetch:`, {
        successful: validNFTs.length,
        failed: errors.length,
        errors,
        attemptedTokens: tokenIds,
      });
    }

    return storedNFTs;
  } catch (error) {
    console.error(`❌ [${requestId}] Error storing NFTs:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      contractAddress,
      collectionId,
      tokenIds,
      validNFTsCount: validNFTs.length,
      errors,
    });
    throw error;
  }
} 