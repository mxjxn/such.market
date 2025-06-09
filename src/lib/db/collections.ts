import { Alchemy, Network } from 'alchemy-sdk';
import { getSupabaseClient } from '~/lib/supabase';
import { retryContractCall, type PublicClient, type HttpTransport, type Chain, type Abi, getProviderWithRetry } from '../nft-metadata';
import type { Database } from '@/db/types/database.types';
import { getCachedCollection, setCachedCollection } from './cache';
import {
  getCachedCollectionNFTs,
  setCachedCollectionNFTs,
  invalidateCollectionCache,
} from './cache';
import { createPublicClient, http, type Address, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Initialize Supabase client
const supabase = getSupabaseClient();

// Initialize viem client
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC!),
}) as PublicClient<HttpTransport, Chain>;

// Add ERC721 ABI items for metadata fetching
const ERC721_METADATA_ABI: Abi = [
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
  parseAbiItem('function totalSupply() view returns (uint256)'),
];

type Collection = Database['public']['Tables']['collections']['Row'];
type NFT = Database['public']['Tables']['nfts']['Row'];

// Type for NFT metadata
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

export async function getCollectionByAddress(contractAddress: string): Promise<Collection | null> {
  // Try cache first
  const cached = await getCachedCollection(contractAddress);
  if (cached) {
    console.log('📦 [Cache] Collection hit:', contractAddress);
    return cached;
  }

  // If not in cache, get from database
  const { data, error } = await supabase
    .from('collections')
    .select()
    .eq('contract_address', contractAddress.toLowerCase())
    .single();

  if (error) {
    console.error('❌ Error fetching collection:', error);
    return null;
  }

  // Cache the result
  if (data) {
    console.log('💾 [Cache] Caching collection:', contractAddress);
    await setCachedCollection(contractAddress, data);
  }

  return data;
}

export async function getCollectionNFTs(
  contractAddress: string,
  page: number,
  pageSize: number
): Promise<{ nfts: NFT[]; total: number }> {
  // Try cache first
  const cached = await getCachedCollectionNFTs(contractAddress, page, pageSize);
  if (cached) {
    console.log('📦 [Cache] Collection NFTs hit:', { contractAddress, page, pageSize });
    return cached;
  }

  console.log('🔄 [Cache] Collection NFTs miss:', { contractAddress, page, pageSize });
  const collection = await getCollectionByAddress(contractAddress);
  if (!collection) {
    return { nfts: [], total: 0 };
  }

  // Get total count
  const { count, error: countError } = await supabase
    .from('nfts')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collection.id);

  if (countError) {
    console.error('❌ Error getting NFT count:', countError);
    return { nfts: [], total: 0 };
  }

  // Get paginated NFTs
  const { data: nfts, error } = await supabase
    .from('nfts')
    .select('*')
    .eq('collection_id', collection.id)
    .order('token_id', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    console.error('❌ Error fetching NFTs:', error);
    return { nfts: [], total: count || 0 };
  }

  const result = { nfts: nfts || [], total: count || 0 };

  // Cache the result
  console.log('💾 [Cache] Caching collection NFTs:', { contractAddress, page, pageSize });
  await setCachedCollectionNFTs(contractAddress, page, pageSize, result);

  return result;
}

export async function upsertCollectionNFTs(
  collectionId: string,
  nfts: NFTMetadata[]
): Promise<void> {
  const nftInserts = nfts.map(nft => ({
    collection_id: collectionId,
    token_id: nft.tokenId,
    title: nft.title,
    description: nft.description,
    image_url: nft.imageUrl,
    thumbnail_url: nft.thumbnailUrl,
    metadata: nft.metadata,
    attributes: nft.attributes,
    media: nft.media,
  }));

  const { error } = await supabase
    .from('nfts')
    .upsert(nftInserts, { onConflict: 'collection_id,token_id' });

  if (error) {
    console.error('❌ Error upserting NFTs:', error);
    throw error;
  }

  // Process traits if available
  const traitInserts = nfts.flatMap(nft => {
    const attributes = nft.attributes;
    if (!attributes) return [];
    
    return attributes.map((attr: { trait_type: string; value: string }) => ({
      collection_id: collectionId,
      trait_type: attr.trait_type,
      trait_value: String(attr.value),
      token_ids: [nft.tokenId],
    }));
  });

  if (traitInserts.length > 0) {
    const { error: traitError } = await supabase
      .from('collection_traits')
      .upsert(traitInserts, {
        onConflict: 'collection_id,trait_type,trait_value',
        ignoreDuplicates: true,
      });

    if (traitError) {
      console.error('❌ Error upserting traits:', traitError);
      // Don't throw here - trait errors shouldn't fail the whole process
    }
  }

  // Invalidate cache for this collection
  const collection = await supabase
    .from('collections')
    .select('contract_address')
    .eq('id', collectionId)
    .single();

  if (collection?.data?.contract_address) {
    console.log('🗑️ [Cache] Invalidating collection cache:', collection.data.contract_address);
    await invalidateCollectionCache(collection.data.contract_address);
  }
}

export async function updateCollectionRefreshTime(
  collectionId: string,
  totalSupply?: number
): Promise<void> {
  const { error } = await supabase
    .from('collections')
    .update({
      last_refresh_at: new Date().toISOString(),
      total_supply: totalSupply,
    })
    .eq('id', collectionId);

  if (error) {
    console.error('❌ Error updating collection refresh time:', error);
    throw error;
  }

  // Invalidate cache for this collection
  const collection = await supabase
    .from('collections')
    .select('contract_address')
    .eq('id', collectionId)
    .single();

  if (collection?.data?.contract_address) {
    console.log('🗑️ [Cache] Invalidating collection cache:', collection.data.contract_address);
    await invalidateCollectionCache(collection.data.contract_address);
  }
}

export async function fetchAndStoreCollectionMetadata(contractAddress: string) {
  console.log('🔄 Fetching collection metadata:', contractAddress);
  
  try {
    // Try Alchemy first
    const metadata = await alchemy.nft.getContractMetadata(contractAddress);
    
    // Insert/update collection in database
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .upsert({
        contract_address: contractAddress.toLowerCase(),
        name: metadata.name || null,
        token_type: metadata.tokenType as 'ERC721' | 'ERC1155',
        total_supply: metadata.totalSupply ? Number(metadata.totalSupply) : null,
        verified: true,
        last_refresh_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (collectionError) {
      console.error('❌ Error upserting collection:', collectionError);
      throw collectionError;
    }

    if (!collectionData) {
      throw new Error('Failed to upsert collection');
    }

    // Try to get total supply from contract if not available from Alchemy
    if (!metadata.totalSupply && metadata.tokenType === 'ERC721') {
      try {
        const client = await getProviderWithRetry();
        const address = contractAddress as Address;
        const totalSupply = await retryContractCall<bigint>(
          client,
          address,
          ERC721_METADATA_ABI,
          'totalSupply',
          []
        );

        if (totalSupply) {
          await updateCollectionRefreshTime(collectionData.id, Number(totalSupply));
        }
      } catch (error) {
        console.error('❌ Error fetching total supply:', error);
        // Don't throw here - we still want to return the collection data
      }
    } else if (!metadata.totalSupply) {
      // For ERC1155, we can't get total supply directly
      // We'll just update the refresh time
      await updateCollectionRefreshTime(collectionData.id);
    }

    return collectionData;
  } catch (error) {
    console.error('❌ Error in fetchAndStoreCollectionMetadata:', error);
    throw error;
  }
} 