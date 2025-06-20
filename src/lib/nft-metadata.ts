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

// Error tracking types
type NFTFetchError = {
  collection_id: string;
  token_id: string;
  error_type: 'metadata_fetch' | 'token_uri' | 'ipfs_gateway' | 'validation';
  error_message: string;
  retry_count?: number;
};

// Multiple IPFS gateways for fallback
const IPFS_GATEWAYS = [
  'https://ipfs.infura.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
];

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

// Helper function to convert IPFS URLs to HTTPS URLs with multiple gateways
function convertIpfsToHttps(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('ipfs://')) {
    const ipfsHash = url.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${ipfsHash}`;
  }
  if (url.startsWith('/ipfs/')) {
    return `${IPFS_GATEWAYS[0]}${url.substring(6)}`;
  }
  return url;
}

// Error tracking function
async function trackNFTError(error: NFTFetchError): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('nft_fetch_errors')
      .upsert({
        collection_id: error.collection_id,
        token_id: error.token_id,
        error_type: error.error_type,
        error_message: error.error_message,
        retry_count: error.retry_count || 0,
      }, {
        onConflict: 'collection_id,token_id,error_type'
      });
  } catch (trackingError) {
    console.error('❌ Failed to track NFT error:', trackingError);
  }
}

// Helper function to get clients with lazy initialization
let alchemy: Alchemy | null = null;
let client: PublicClient<HttpTransport, Chain> | null = null;
let supabase: ReturnType<typeof getSupabaseClient> | null = null;

// Export the missing functions that collections.ts needs
export async function getProviderWithRetry(): Promise<PublicClient<HttpTransport, Chain>> {
  const { client } = await getClients();
  if (!client) {
    throw new Error('Failed to initialize Viem client');
  }
  return client;
}

export async function retryContractCall<T>(
  client: PublicClient<HttpTransport, Chain>,
  address: Address,
  abi: Abi,
  functionName: string,
  args: unknown[],
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.readContract({
        address,
        abi,
        functionName: functionName as keyof typeof abi,
        args: args as readonly unknown[],
      }) as T;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

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

// Enhanced metadata fetching with multiple sources
async function fetchFromAlchemy(contractAddress: string, tokenId: string): Promise<DatabaseNFTInsert | null> {
  if (!alchemy) return null;
  
  try {
    const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
    if (nft) {
      return {
        id: uuidv4(),
        collection_id: '', // Will be set by caller
        token_id: tokenId,
        title: nft.title || `NFT #${tokenId}`,
        description: nft.description || null,
        image_url: nft.media[0]?.gateway || null,
        thumbnail_url: nft.media[0]?.thumbnail || null,
        metadata: nft.rawMetadata ? JSON.stringify(nft.rawMetadata) : null,
        attributes: nft.rawMetadata?.attributes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn(`⚠️ Alchemy fetch failed for token ${tokenId}:`, error);
  }
  return null;
}

async function fetchFromTokenURI(contractAddress: string, tokenId: string): Promise<DatabaseNFTInsert | null> {
  const { client } = await getClients();
  if (!client) return null;

  try {
    // Try ERC721 first
    const tokenUri = await client.readContract({
      address: contractAddress as Address,
      abi: ERC721_METADATA_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    });

    if (tokenUri) {
      const metadataUrl = convertIpfsToHttps(tokenUri);
      if (metadataUrl) {
        const response = await fetch(metadataUrl);
        if (response.ok) {
          const metadata = await response.json();
          const openSeaMetadata = convertToOpenSeaMetadata(metadata);
          
          const validationResult = validateOpenSeaMetadata(openSeaMetadata);
          if (validationResult.isValid) {
            return {
              id: uuidv4(),
              collection_id: '', // Will be set by caller
              token_id: tokenId,
              title: openSeaMetadata.name || `NFT #${tokenId}`,
              description: openSeaMetadata.description || null,
              image_url: convertIpfsToHttps(openSeaMetadata.image) || null,
              thumbnail_url: convertIpfsToHttps(openSeaMetadata.image) || null,
              metadata: JSON.stringify(metadata),
              attributes: openSeaMetadata.attributes || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        }
      }
    }

    // Try ERC1155 if ERC721 fails
    const uri = await client.readContract({
      address: contractAddress as Address,
      abi: ERC1155_METADATA_ABI,
      functionName: 'uri',
      args: [BigInt(tokenId)],
    });

    if (uri) {
      // Process ERC1155 metadata similar to ERC721
      const metadataUrl = convertIpfsToHttps(uri);
      if (metadataUrl) {
        const response = await fetch(metadataUrl);
        if (response.ok) {
          const metadata = await response.json();
          const openSeaMetadata = convertToOpenSeaMetadata(metadata);
          
          const validationResult = validateOpenSeaMetadata(openSeaMetadata);
          if (validationResult.isValid) {
            return {
              id: uuidv4(),
              collection_id: '', // Will be set by caller
              token_id: tokenId,
              title: openSeaMetadata.name || `NFT #${tokenId}`,
              description: openSeaMetadata.description || null,
              image_url: convertIpfsToHttps(openSeaMetadata.image) || null,
              thumbnail_url: convertIpfsToHttps(openSeaMetadata.image) || null,
              metadata: JSON.stringify(metadata),
              attributes: openSeaMetadata.attributes || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ TokenURI fetch failed for token ${tokenId}:`, error);
  }
  return null;
}

// Enhanced metadata fetching with multiple fallbacks
async function tryFetchMetadataEnhanced(
  contractAddress: string, 
  tokenId: string,
  collectionId: string
): Promise<DatabaseNFTInsert | null> {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🔄 [${requestId}] Starting enhanced metadata fetch for token:`, {
    contractAddress,
    tokenId,
  });

  // Try multiple metadata sources in order of reliability
  const metadataSources = [
    {
      name: 'Alchemy',
      fetch: () => fetchFromAlchemy(contractAddress, tokenId),
    },
    {
      name: 'TokenURI',
      fetch: () => fetchFromTokenURI(contractAddress, tokenId),
    },
  ];

  for (const source of metadataSources) {
    try {
      console.log(`🔍 [${requestId}] Trying ${source.name}...`);
      const metadata = await source.fetch();
      if (metadata) {
        metadata.collection_id = collectionId;
        console.log(`✅ [${requestId}] Metadata found via ${source.name} for token ${tokenId}`);
        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️ [${requestId}] ${source.name} failed for token ${tokenId}:`, error);
      
      // Track the error
      await trackNFTError({
        collection_id: collectionId,
        token_id: tokenId,
        error_type: 'metadata_fetch',
        error_message: `${source.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  console.log(`❌ [${requestId}] No valid metadata found for token ${tokenId}`);
  
  // Track final failure
  await trackNFTError({
    collection_id: collectionId,
    token_id: tokenId,
    error_type: 'metadata_fetch',
    error_message: 'All metadata sources failed',
  });
  
  return null;
}

// Retry logic for failed metadata fetches
export async function retryMetadataFetch(
  contractAddress: string, 
  tokenId: string,
  collectionId: string,
  maxRetries: number = 3
): Promise<DatabaseNFTInsert | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const metadata = await tryFetchMetadataEnhanced(contractAddress, tokenId, collectionId);
      if (metadata) return metadata;
    } catch (error) {
      if (attempt === maxRetries) {
        await trackNFTError({
          collection_id: collectionId,
          token_id: tokenId,
          error_type: 'metadata_fetch',
          error_message: `Failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          retry_count: maxRetries,
        });
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return null;
}

export async function fetchAndStoreNFTMetadata(contractAddress: string, tokenIds: string[], collectionId: string, { forceRefresh = false } = {}) {
  const { supabase } = await getClients();
  if (!supabase) {
    console.error('❌ [Refactor] Supabase client not available');
    return;
  }

  // Filter out token IDs that are likely invalid (too high numbers for small collections)
  const validTokenIds = tokenIds.filter(tokenId => {
    const numId = parseInt(tokenId);
    // For small collections, skip very high token IDs that are likely invalid
    if (numId > 100 && tokenIds.length <= 5) {
      console.log(`⏭️ [Refactor] Skipping likely invalid token ID ${tokenId} for small collection`);
      return false;
    }
    return true;
  });

  if (validTokenIds.length !== tokenIds.length) {
    console.log(`🔍 [Refactor] Filtered ${tokenIds.length - validTokenIds.length} likely invalid token IDs`);
  }

  for (const tokenId of validTokenIds) {
    try {
      console.log(`🔄 [Refactor] Fetching metadata for contract ${contractAddress}, tokenId ${tokenId}`);
      // 1. Check DB first (unless forceRefresh)
      if (!forceRefresh) {
        const { data: dbNFT, error: dbError } = await supabase
          .from('nfts')
          .select('*')
          .eq('collection_id', collectionId)
          .eq('token_id', tokenId)
          .single();
        if (dbError) {
          console.log(`⚠️ [Refactor] DB fetch error:`, dbError.message);
        }
        if (dbNFT && dbNFT.metadata) {
          console.log(`✅ [Refactor] Found metadata in DB for token ${tokenId}`);
          continue;
        }
      }

      let metadata = null;
      let source = null;
      let uri = null;
      let raw = null;

      // 2a. Try Alchemy
      try {
        console.log(`🔍 [Refactor] Trying Alchemy for token ${tokenId}...`);
        const { fetchFromAlchemy } = await import('./alchemy');
        const alchemyResult = await fetchFromAlchemy(contractAddress, tokenId);
        if (alchemyResult && alchemyResult.metadata) {
          metadata = alchemyResult.metadata;
          source = 'alchemy';
          uri = alchemyResult.tokenUri;
          raw = alchemyResult.raw;
          console.log(`✅ [Refactor] Alchemy success for token ${tokenId}`);
        }
      } catch (e) {
        console.log(`⚠️ [Refactor] Alchemy fetch failed:`, e instanceof Error ? e.message : e);
      }

      // 2b. Try ERC721 tokenURI
      if (!metadata) {
        try {
          console.log(`🔍 [Refactor] Trying ERC721 tokenURI for token ${tokenId}...`);
          const tokenUri = await getTokenURI(contractAddress, tokenId);
          if (tokenUri) {
            const { metadata: meta, raw: rawMeta } = await fetchMetadataFromURI(tokenUri, tokenId);
            if (meta) {
              metadata = meta;
              source = 'tokenURI';
              uri = tokenUri;
              raw = rawMeta;
              console.log(`✅ [Refactor] ERC721 tokenURI success for token ${tokenId}`);
            }
          }
        } catch (e) {
          console.log(`⚠️ [Refactor] ERC721 tokenURI fetch failed:`, e instanceof Error ? e.message : e);
        }
      }

      // 2c. Try ERC1155 uri
      if (!metadata) {
        try {
          console.log(`🔍 [Refactor] Trying ERC1155 uri for token ${tokenId}...`);
          const erc1155Uri = await getERC1155URI(contractAddress, tokenId);
          if (erc1155Uri) {
            const { metadata: meta, raw: rawMeta } = await fetchMetadataFromURI(erc1155Uri, tokenId);
            if (meta) {
              metadata = meta;
              source = 'erc1155_uri';
              uri = erc1155Uri;
              raw = rawMeta;
              console.log(`✅ [Refactor] ERC1155 uri success for token ${tokenId}`);
            }
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : '';
          if (errorMessage.includes('Invalid token')) {
            console.log(`🛑 [Refactor] Token ${tokenId} is invalid, skipping remaining attempts`);
            await logNFTFetchError(collectionId, tokenId, 'invalid_token', 'Token does not exist');
            continue; // Skip to next token
          } else {
            console.log(`⚠️ [Refactor] ERC1155 uri fetch failed:`, errorMessage);
          }
        }
      }

      // 2d. Try direct IPFS fetch (from contract URI, even if not {id}-based)
      if (!metadata) {
        try {
          console.log(`🔍 [Refactor] Trying direct IPFS fetch for token ${tokenId}...`);
          // Try ERC1155 uri again, but treat as direct IPFS if not {id}
          const erc1155Uri = await getERC1155URI(contractAddress, tokenId);
          if (erc1155Uri) {
            const { metadata: meta, raw: rawMeta } = await fetchMetadataFromURI(erc1155Uri, tokenId);
            if (meta) {
              metadata = meta;
              source = 'direct_ipfs';
              uri = erc1155Uri;
              raw = rawMeta;
              console.log(`✅ [Refactor] Direct IPFS fetch success for token ${tokenId}`);
            }
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : '';
          if (errorMessage.includes('Invalid token')) {
            console.log(`🛑 [Refactor] Token ${tokenId} is invalid, skipping remaining attempts`);
            await logNFTFetchError(collectionId, tokenId, 'invalid_token', 'Token does not exist');
            continue; // Skip to next token
          } else {
            console.log(`⚠️ [Refactor] Direct IPFS fetch failed:`, errorMessage);
          }
        }
      }

      // 3. Upsert if found
      if (metadata) {
        try {
          const upsertPayload = {
            collection_id: collectionId,
            token_id: tokenId,
            title: metadata.name || null,
            description: metadata.description || null,
            image_url: metadata.image || null,
            thumbnail_url: metadata.thumbnail || null,
            metadata: metadata,
            attributes: metadata.attributes || null,
            media: metadata.media || null,
          };
          console.log(`💾 [Refactor] Upserting NFT metadata:`, upsertPayload);
          const { data, error } = await supabase
            .from('nfts')
            .upsert(upsertPayload, { onConflict: 'collection_id,token_id' })
            .select()
            .single();
          if (error) {
            console.error(`❌ [Refactor] Supabase upsert error for token ${tokenId}:`, error);
            await logNFTFetchError(collectionId, tokenId, 'supabase_upsert', error.message);
          } else {
            console.log(`✅ [Refactor] Supabase upsert success for token ${tokenId}:`, data);
          }
        } catch (e) {
          console.error(`❌ [Refactor] Exception during Supabase upsert for token ${tokenId}:`, e);
          await logNFTFetchError(collectionId, tokenId, 'supabase_upsert', e?.message || e);
        }
        continue;
      }

      // 4. Log error if all fail
      await logNFTFetchError(collectionId, tokenId, 'metadata_fetch', 'All sources failed');
      console.log(`❌ [Refactor] All sources failed for token ${tokenId}`);
    } catch (err) {
      console.error(`❌ [Refactor] Unexpected error for token ${tokenId}:`, err);
      await logNFTFetchError(collectionId, tokenId, 'unexpected', err?.message || err);
    }
  }
}

// Helper to log errors to nft_fetch_errors table
async function logNFTFetchError(collectionId: string, tokenId: string, errorType: string, errorMessage: string) {
  try {
    const { supabase } = await getClients();
    if (!supabase) {
      console.error('❌ [Metadata] Supabase client not available for error logging');
      return;
    }
    
    const { data, error } = await supabase
      .from('nft_fetch_errors')
      .upsert({
        collection_id: collectionId,
        token_id: tokenId,
        error_type: errorType,
        error_message: errorMessage,
        retry_count: 0,
      }, {
        onConflict: 'collection_id,token_id,error_type',
        ignoreDuplicates: false,
      })
      .select()
      .single();
    if (error) {
      console.error(`❌ [Metadata] Failed to log error to nft_fetch_errors:`, error);
    } else {
      console.log(`📝 [Metadata] Logged error to nft_fetch_errors:`, data);
    }
  } catch (e) {
    console.error(`❌ [Metadata] Exception logging error to nft_fetch_errors:`, e);
  }
}

async function fetchMetadataFromURI(uri: string, tokenId: string): Promise<{ metadata: any; raw: any }> {
  console.log(`🔍 [Metadata] Fetching from URI: ${uri}`);
  console.log(`🔍 [Metadata] Token ID: ${tokenId}`);
  
  // Handle {id} replacement for ERC1155
  let processedUri = uri;
  if (uri.includes('{id}')) {
    // Convert tokenId to hex and pad to 64 characters
    const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
    processedUri = uri.replace('{id}', hexId);
    console.log(`🔄 [Metadata] Replaced {id} with hex: ${hexId}`);
    console.log(`🔗 [Metadata] Processed URI: ${processedUri}`);
  } else {
    console.log(`🔗 [Metadata] Using direct URI (no {id} replacement needed): ${processedUri}`);
  }
  
  // Try multiple gateways for IPFS
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];

  for (const gateway of gateways) {
    try {
      let fetchUrl = processedUri;
      if (processedUri.startsWith('ipfs://')) {
        fetchUrl = processedUri.replace('ipfs://', gateway);
        console.log(`🌐 [Metadata] Using gateway ${gateway} for IPFS`);
      }
      
      console.log(`📡 [Metadata] Fetching from: ${fetchUrl}`);
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NFTMetadataBot/1.0)',
        },
      });
      
      console.log(`📊 [Metadata] Response status: ${response.status}`);
      console.log(`📊 [Metadata] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.log(`❌ [Metadata] HTTP error ${response.status}: ${response.statusText}`);
        continue;
      }
      
      const text = await response.text();
      console.log(`📄 [Metadata] Response body (first 500 chars):`, text.substring(0, 500));
      
      const metadata = JSON.parse(text);
      console.log(`✅ [Metadata] Successfully parsed metadata:`, metadata);
      
      // Process IPFS image URLs in the metadata
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        const imageUrl = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
        metadata.image = imageUrl;
        console.log(`🖼️ [Metadata] Converted IPFS image URL: ${imageUrl}`);
      }
      
      return { metadata, raw: text };
    } catch (error) {
      console.log(`❌ [Metadata] Failed with gateway ${gateway}:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }
  
  throw new Error('All metadata sources failed');
}

// Helper functions for getting URIs
async function getTokenURI(contractAddress: string, tokenId: string): Promise<string | null> {
  try {
    const { client } = await getClients();
    if (!client) return null;

    const tokenUri = await client.readContract({
      address: contractAddress as Address,
      abi: ERC721_METADATA_ABI,
      functionName: 'tokenURI',
      args: [BigInt(tokenId)],
    });

    return tokenUri || null;
  } catch (error) {
    console.log(`⚠️ [Metadata] ERC721 tokenURI failed for token ${tokenId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function getERC1155URI(contractAddress: string, tokenId: string): Promise<string | null> {
  try {
    const { client } = await getClients();
    if (!client) return null;

    const uri = await client.readContract({
      address: contractAddress as Address,
      abi: ERC1155_METADATA_ABI,
      functionName: 'uri',
      args: [BigInt(tokenId)],
    });

    return uri || null;
  } catch (error) {
    console.log(`⚠️ [Metadata] ERC1155 uri failed for token ${tokenId}:`, error instanceof Error ? error.message : error);
    return null;
  }
} 