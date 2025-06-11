import { getSupabaseClient } from '~/lib/supabase';
import type { Database } from '@/db/types/database.types';

type NFTOwnership = Database['public']['Tables']['nft_ownership']['Row'];
type UserCollection = Database['public']['Tables']['user_collections']['Row'];
type WalletCollectionMapping = Database['public']['Tables']['wallet_collection_mapping']['Row'];

const supabase = getSupabaseClient();

/**
 * Get NFT ownership information
 */
export async function getNFTOwnership(
  collectionId: string,
  tokenId: string
): Promise<NFTOwnership | null> {
  const { data, error } = await supabase
    .from('nft_ownership')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('token_id', tokenId)
    .single();

  if (error) {
    console.error('❌ Error fetching NFT ownership:', error);
    return null;
  }

  return data;
}

/**
 * Set NFT ownership
 */
export async function setNFTOwnership(
  collectionId: string,
  tokenId: string,
  ownerAddress: string
): Promise<void> {
  const { error } = await supabase
    .from('nft_ownership')
    .upsert({
      collection_id: collectionId,
      token_id: tokenId,
      owner_address: ownerAddress.toLowerCase(),
      last_verified_at: new Date().toISOString(),
    }, {
      onConflict: 'collection_id,token_id,owner_address',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('❌ Error setting NFT ownership:', error);
    throw error;
  }
}

/**
 * Get all NFTs owned by a user in a specific collection
 */
export async function getUserCollectionNFTs(
  userAddress: string,
  collectionId: string
): Promise<NFTOwnership[]> {
  const { data, error } = await supabase
    .from('nft_ownership')
    .select('*')
    .eq('owner_address', userAddress.toLowerCase())
    .eq('collection_id', collectionId);

  if (error) {
    console.error('❌ Error fetching user collection NFTs:', error);
    return [];
  }

  return data || [];
}

/**
 * Get user collection summary
 */
export async function getUserCollection(
  userAddress: string,
  collectionId: string
): Promise<UserCollection | null> {
  const { data, error } = await supabase
    .from('user_collections')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .eq('collection_id', collectionId)
    .single();

  if (error) {
    console.error('❌ Error fetching user collection:', error);
    return null;
  }

  return data;
}

/**
 * Get all collections owned by a wallet
 */
export async function getWalletCollections(
  walletAddress: string
): Promise<WalletCollectionMapping[]> {
  const { data, error } = await supabase
    .from('wallet_collection_mapping')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('last_owned_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching wallet collections:', error);
    return [];
  }

  return data || [];
}

/**
 * Get collection owners
 */
export async function getCollectionOwners(
  collectionId: string
): Promise<{ owner_address: string; token_count: number }[]> {
  const { data, error } = await supabase
    .from('user_collections')
    .select('user_address, token_count')
    .eq('collection_id', collectionId)
    .order('token_count', { ascending: false });

  if (error) {
    console.error('❌ Error fetching collection owners:', error);
    return [];
  }

  return data?.map(row => ({
    owner_address: row.user_address,
    token_count: row.token_count
  })) || [];
}

/**
 * Update NFT ownership from existing nfts table data
 */
export async function syncNFTsOwnership(): Promise<void> {
  console.log('🔄 Syncing NFT ownership from nfts table...');
  
  const { data: nfts, error } = await supabase
    .from('nfts')
    .select('collection_id, token_id, owner_address, last_owner_check_at')
    .not('owner_address', 'is', null)
    .neq('owner_address', '');

  if (error) {
    console.error('❌ Error fetching NFTs for ownership sync:', error);
    return;
  }

  if (!nfts || nfts.length === 0) {
    console.log('ℹ️ No NFTs found for ownership sync');
    return;
  }

  console.log(`📦 Syncing ownership for ${nfts.length} NFTs...`);

  const ownershipData = nfts.map(nft => ({
    collection_id: nft.collection_id,
    token_id: nft.token_id,
    owner_address: nft.owner_address!.toLowerCase(),
    last_verified_at: nft.last_owner_check_at || new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('nft_ownership')
    .upsert(ownershipData, {
      onConflict: 'collection_id,token_id,owner_address',
      ignoreDuplicates: false
    });

  if (upsertError) {
    console.error('❌ Error upserting NFT ownership:', upsertError);
    return;
  }

  console.log(`✅ Successfully synced ownership for ${nfts.length} NFTs`);
}

/**
 * Clean up old ownership records
 */
export async function cleanupOldOwnershipRecords(
  olderThanDays: number = 30
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  console.log(`🧹 Cleaning up ownership records older than ${olderThanDays} days...`);

  // Clean up old nft_ownership records
  const { error: ownershipError } = await supabase
    .from('nft_ownership')
    .delete()
    .lt('last_verified_at', cutoffDate.toISOString());

  if (ownershipError) {
    console.error('❌ Error cleaning up old ownership records:', ownershipError);
  } else {
    console.log('✅ Cleaned up old ownership records');
  }

  // Clean up old wallet_collection_mapping records
  const { error: mappingError } = await supabase
    .from('wallet_collection_mapping')
    .delete()
    .lt('last_owned_at', cutoffDate.toISOString());

  if (mappingError) {
    console.error('❌ Error cleaning up old mapping records:', mappingError);
  } else {
    console.log('✅ Cleaned up old mapping records');
  }
}

/**
 * Get ownership statistics
 */
export async function getOwnershipStats(): Promise<{
  totalOwnershipRecords: number;
  totalUserCollections: number;
  totalWalletMappings: number;
  uniqueOwners: number;
  uniqueCollections: number;
}> {
  const [
    { count: ownershipCount },
    { count: userCollectionsCount },
    { count: walletMappingsCount },
    { data: uniqueOwnersData },
    { data: uniqueCollectionsData }
  ] = await Promise.all([
    supabase.from('nft_ownership').select('*', { count: 'exact', head: true }),
    supabase.from('user_collections').select('*', { count: 'exact', head: true }),
    supabase.from('wallet_collection_mapping').select('*', { count: 'exact', head: true }),
    supabase.from('nft_ownership').select('owner_address'),
    supabase.from('nft_ownership').select('collection_id'),
  ]);

  // Count unique values manually
  const uniqueOwners = new Set(uniqueOwnersData?.map(row => row.owner_address) || []).size;
  const uniqueCollections = new Set(uniqueCollectionsData?.map(row => row.collection_id) || []).size;

  return {
    totalOwnershipRecords: ownershipCount || 0,
    totalUserCollections: userCollectionsCount || 0,
    totalWalletMappings: walletMappingsCount || 0,
    uniqueOwners,
    uniqueCollections,
  };
} 