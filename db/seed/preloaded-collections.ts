import { Alchemy, Network, Nft, GetNftsForContractOptions, NftRawMetadata } from 'alchemy-sdk';
import { sortedPreloadedCollections } from '../../config/preloaded-collections';
import { getSupabaseClient } from '../../src/lib/supabase';

// Initialize clients
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Use getSupabaseClient() instead of supabase
const supabase = getSupabaseClient();

// Rate limiting constants
const RATE_LIMIT_DELAY = 1000; // 1 second between API calls
const BATCH_SIZE = 10; // Number of NFTs to fetch in parallel
const MAX_RETRIES = 3; // Maximum number of retries for failed requests

// Helper function for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

interface NFTMetadata {
  attributes?: NFTAttribute[];
}

async function fetchNFTsWithRetry(
  contractAddress: string,
  startToken: string,
  endToken: string,
  retryCount = 0
): Promise<Nft[]> {
  try {
    const start = parseInt(startToken);
    const end = parseInt(endToken);
    const options: GetNftsForContractOptions = {
      pageKey: startToken,
      pageSize: end - start + 1,
    };
    const nfts = await alchemy.nft.getNftsForContract(contractAddress, options);
    return nfts.nfts;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`Retry ${retryCount + 1} for ${contractAddress} (${startToken}-${endToken})`);
      await sleep(RATE_LIMIT_DELAY * (retryCount + 1)); // Exponential backoff
      return fetchNFTsWithRetry(contractAddress, startToken, endToken, retryCount + 1);
    }
    throw error;
  }
}

async function processNFTBatch(
  collectionId: string,
  nfts: Nft[]
): Promise<void> {
  const nftInserts = nfts.map(nft => {
    const metadata = nft.raw as unknown as NFTMetadata;
    return {
      collection_id: collectionId,
      token_id: nft.tokenId,
      title: nft.name || null,
      description: nft.description || null,
      image_url: nft.image?.originalUrl || null,
      thumbnail_url: nft.image?.thumbnailUrl || null,
      metadata: nft.raw,
      attributes: metadata.attributes || null,
      media: null, // We'll handle media separately if needed
    };
  });

  // Insert NFTs in batches
  const { error } = await supabase
    .from('nfts')
    .upsert(nftInserts, { onConflict: 'collection_id,token_id' });

  if (error) {
    console.error('Error inserting NFTs:', error);
    throw error;
  }

  // Process traits if available
  const traitInserts = nfts.flatMap(nft => {
    const metadata = nft.raw as unknown as NFTMetadata;
    const attributes = metadata.attributes;
    if (!attributes) return [];
    
    return attributes.map(attr => ({
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
      console.error('Error inserting traits:', traitError);
      // Don't throw here - trait errors shouldn't fail the whole process
    }
  }
}

async function seedCollection(collection: typeof sortedPreloadedCollections[0]): Promise<void> {
  console.log(`\n🔄 Seeding collection: ${collection.name} (${collection.contractAddress})`);
  
  try {
    // Get collection metadata from Alchemy
    const metadata = await alchemy.nft.getContractMetadata(collection.contractAddress);
    
    // Insert/update collection in database
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .upsert({
        contract_address: collection.contractAddress.toLowerCase(),
        name: collection.name,
        token_type: collection.tokenType,
        total_supply: metadata.totalSupply ? Number(metadata.totalSupply) : null,
        verified: true,
        last_refresh_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (collectionError) {
      throw collectionError;
    }

    if (!collectionData) {
      throw new Error('Failed to create/update collection');
    }

    // Get total supply for pagination
    const totalSupply = metadata.totalSupply ? Number(metadata.totalSupply) : 0;
    console.log(`Total supply: ${totalSupply}`);

    // Process NFTs in batches
    for (let i = 0; i < totalSupply; i += BATCH_SIZE) {
      const startToken = i.toString();
      const endToken = Math.min(i + BATCH_SIZE - 1, totalSupply - 1).toString();
      
      console.log(`Processing tokens ${startToken}-${endToken}...`);
      
      const nfts = await fetchNFTsWithRetry(
        collection.contractAddress,
        startToken,
        endToken
      );

      await processNFTBatch(collectionData.id, nfts);
      
      // Rate limiting delay between batches
      await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`✅ Completed seeding collection: ${collection.name}`);
  } catch (error) {
    console.error(`❌ Error seeding collection ${collection.name}:`, error);
    throw error;
  }
}

export async function seedPreloadedCollections(): Promise<void> {
  console.log('🚀 Starting preloaded collections seeding...');
  
  for (const collection of sortedPreloadedCollections) {
    try {
      await seedCollection(collection);
    } catch (error) {
      console.error(`Failed to seed collection ${collection.name}:`, error);
      // Continue with next collection even if one fails
    }
  }
  
  console.log('✨ Completed seeding preloaded collections');
}

// Run if called directly
if (require.main === module) {
  seedPreloadedCollections()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error during seeding:', error);
      process.exit(1);
    });
} 