import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Load environment variables first, before any other import
const envPath = path.resolve(process.cwd(), '.env.local');

import { Alchemy, Network } from 'alchemy-sdk';
import { getCollectionByAddress, upsertCollectionFromAlchemyMetadata, updateCollectionRefreshTime } from '../src/lib/db/collections';
import { fetchAndStoreNFTMetadata } from '../src/app/api/collection/[contractAddress]/nfts/route';

// Path to the CSV file with contract addresses
const CSV_PATH = path.resolve(process.cwd(), 'collections-to-seed.csv');

// Read contract addresses from CSV
function readContractAddresses(csvPath: string): string[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  const lines = fs.readFileSync(csvPath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
  return lines;
}

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

async function seedAllCollections() {
  const contractAddresses = readContractAddresses(CSV_PATH);
  for (const contractAddress of contractAddresses) {
    try {
      console.log(`\n🔍 Seeding collection: ${contractAddress}`);
      // 1. Get or create collection
      let collection = await getCollectionByAddress(contractAddress);
      let metadata;
      if (!collection) {
        metadata = await alchemy.nft.getContractMetadata(contractAddress);
        collection = await upsertCollectionFromAlchemyMetadata(contractAddress, metadata);
      }
      if (!collection) {
        console.warn(`⚠️  Could not find or create collection for ${contractAddress}`);
        continue;
      }
      // 2. Get total supply
      const totalSupply = collection.total_supply || (metadata && metadata.totalSupply) || 0;
      if (!totalSupply) {
        console.warn(`⚠️  No total supply found for ${contractAddress}`);
        continue;
      }
      const tokenIds = Array.from({ length: totalSupply }, (_, i) => i.toString());
      // 3. Fetch and store all NFTs
      await fetchAndStoreNFTMetadata(contractAddress, tokenIds, collection.id);
      await updateCollectionRefreshTime(collection.id);
      console.log(`✅ Seeded collection: ${contractAddress}`);
    } catch (err) {
      console.error(`❌ Error seeding collection ${contractAddress}:`, err);
    }
  }
}

seedAllCollections().then(() => {
  console.log('\n✨ All collections processed!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error in seeding process:', err);
  process.exit(1);
}); 