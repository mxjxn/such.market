// Load environment variables first, before any imports
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

const envPath = resolve(process.cwd(), '.env.local');
console.log('🔍 Environment Debug:');
console.log('1. Current working directory:', process.cwd());
console.log('2. Looking for .env.local at:', envPath);
console.log('3. .env.local exists:', existsSync(envPath));

// Load environment variables
const result = dotenv.config({ path: envPath });
console.log('4. dotenv config result:', {
  error: result.error,
  parsed: result.parsed ? Object.keys(result.parsed) : null
});

// Debug all environment variables
console.log('5. Environment variables:');
console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('- All env keys:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));

// Now import other modules after environment is loaded
import { Redis } from '@upstash/redis';
import { Database } from '../types/database.types';
import { Alchemy, Network, Nft } from 'alchemy-sdk';
import { getSupabaseClient } from '../../src/lib/supabase';

// Initialize clients
const supabase = getSupabaseClient();
console.log('✅ Supabase client initialized');

// Define types for NFT metadata
interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface ExtendedNft extends Nft {
  title?: string;
  description?: string;
  media?: Array<{
    gateway: string | null;
    thumbnail: string | null;
    raw: string | null;
    format: string;
    bytes: number;
  }>;
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

async function migrateCollections() {
  console.log('🔄 Migrating collections...');
  
  // Get collections from Redis
  const collections = await redis.get<Record<string, string>>('collections') || {};
  
  for (const [name, address] of Object.entries(collections)) {
    console.log(`Processing collection: ${name} (${address})`);
    
    try {
      // Get collection metadata from Alchemy
      const metadata = await alchemy.nft.getContractMetadata(address);
      
      // Insert into Supabase
      const { data, error } = await supabase
        .from('collections')
        .upsert({
          contract_address: address.toLowerCase(),
          name: name,
          token_type: metadata.tokenType as 'ERC721' | 'ERC1155',
          verified: true, // Mark known collections as verified
        })
        .select()
        .single();
      
      if (error) {
        console.error(`Error inserting collection ${name}:`, error);
        continue;
      }
      
      console.log(`✅ Migrated collection: ${name}`);
      
      // Migrate NFTs for this collection
      if (data) {
        await migrateNFTs(data.id, address);
      }
    } catch (error) {
      console.error(`Error processing collection ${name}:`, error);
    }
  }
}

async function migrateNFTs(collectionId: string, contractAddress: string) {
  console.log(`🔄 Migrating NFTs for collection ${contractAddress}...`);
  
  // Get NFTs from Alchemy
  const response = await alchemy.nft.getNftsForContract(contractAddress, {
    pageSize: 100,
  });
  
  for (const nft of response.nfts) {
    try {
      // Get detailed metadata
      const metadata = await alchemy.nft.getNftMetadata(contractAddress, nft.tokenId);
      const extendedNft = nft as ExtendedNft;
      
      // Process attributes
      const attributes = metadata.raw?.metadata?.attributes || [];
      
      // Insert NFT into Supabase
      const { error: nftError } = await supabase
        .from('nfts')
        .upsert({
          collection_id: collectionId,
          token_id: nft.tokenId,
          title: extendedNft.title || metadata.raw?.metadata?.name,
          description: extendedNft.description || metadata.raw?.metadata?.description,
          image_url: extendedNft.media?.[0]?.gateway || metadata.raw?.metadata?.image,
          thumbnail_url: extendedNft.media?.[0]?.thumbnail,
          metadata: metadata.raw?.metadata,
          attributes: attributes,
          media: extendedNft.media,
        });
      
      if (nftError) {
        console.error(`Error inserting NFT ${nft.tokenId}:`, nftError);
        continue;
      }
      
      // Process traits
      if (attributes.length > 0) {
        const traitInserts = attributes.map((attr: NFTAttribute) => ({
          collection_id: collectionId,
          trait_type: attr.trait_type,
          trait_value: attr.value,
          token_ids: [nft.tokenId], // We'll update this with an array of all tokens later
        }));
        
        const { error: traitError } = await supabase
          .from('collection_traits')
          .upsert(traitInserts);
        
        if (traitError) {
          console.error(`Error inserting traits for NFT ${nft.tokenId}:`, traitError);
        }
      }
      
      console.log(`✅ Migrated NFT: ${nft.tokenId}`);
    } catch (error) {
      console.error(`Error processing NFT ${nft.tokenId}:`, error);
    }
  }
  
  // Update trait token_ids arrays
  await updateTraitTokenIds(collectionId);
}

async function updateTraitTokenIds(collectionId: string) {
  console.log(`🔄 Updating trait token_ids for collection ${collectionId}...`);
  
  // Get all traits for the collection
  const { data: traits, error: traitsError } = await supabase
    .from('collection_traits')
    .select('*')
    .eq('collection_id', collectionId);
  
  if (traitsError) {
    console.error('Error fetching traits:', traitsError);
    return;
  }
  
  // Get all NFTs for the collection
  const { data: nfts, error: nftsError } = await supabase
    .from('nfts')
    .select('token_id, attributes')
    .eq('collection_id', collectionId);
  
  if (nftsError) {
    console.error('Error fetching NFTs:', nftsError);
    return;
  }
  
  // Update each trait with all matching token IDs
  for (const trait of traits) {
    const matchingTokenIds = nfts
      .filter((nft: { token_id: string; attributes: NFTAttribute[] | null }) => 
        nft.attributes?.some((attr: NFTAttribute) => 
          attr.trait_type === trait.trait_type && 
          attr.value === trait.trait_value
        )
      )
      .map((nft: { token_id: string }) => nft.token_id);
    
    if (matchingTokenIds.length > 0) {
      const { error: updateError } = await supabase
        .from('collection_traits')
        .update({ token_ids: matchingTokenIds })
        .eq('id', trait.id);
      
      if (updateError) {
        console.error(`Error updating trait ${trait.trait_type}:${trait.trait_value}:`, updateError);
      }
    }
  }
}

async function main() {
  try {
    console.log('🚀 Starting database migration...');
    await migrateCollections();
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Replace the require.main check with ESM-compatible check
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

// At the bottom, replace the require.main check with:
if (isMainModule) {
  // Run the seed function
  main()
    .then(() => {
      console.log('✅ Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
} 