import { Redis } from "@upstash/redis";
import { APP_NAME } from "../src/lib/constants";
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const COLLECTION_KEY = `${APP_NAME}:collections`;

// Known collections to add
const KNOWN_COLLECTIONS = [
  { name: "Based Dickbutts", address: "0x0c2e57efddba8c768147d1fdf9176a0a6ebd5d83" },
  { name: "Based Ghouls", address: "0x7ef6a7b2b72a60ac7f6aacf0e6cf5a7b7d0f2c2a" },
  { name: "Based Apes", address: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d" }
];

async function main() {
  try {
    console.log('🔍 Inspecting Redis store...\n');

    // Check if Redis is connected
    console.log('Testing Redis connection...');
    await redis.ping();
    console.log('✅ Redis connection successful\n');

    // Get all collections
    console.log('Fetching collections...');
    const collections = await redis.get<Record<string, string>>(COLLECTION_KEY) || {};
    
    console.log('\n📚 Collections in Redis:');
    console.log('------------------------');
    if (Object.keys(collections).length === 0) {
      console.log('No collections found in Redis');
    } else {
      Object.entries(collections).forEach(([name, address], index) => {
        console.log(`${index + 1}. ${name}`);
        console.log(`   Address: ${address}`);
        console.log('------------------------');
      });
    }

    // Get collection count
    console.log('\n📊 Collection Stats:');
    console.log('------------------------');
    console.log(`Total collections: ${Object.keys(collections).length}`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.message.includes('connect')) {
      console.log('\n⚠️  Make sure your Redis credentials are correct:');
      console.log('KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
      console.log('KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');
    }
  } finally {
    process.exit(0);
  }
}

// Add a collection manually
async function addCollection(name: string, address: string) {
  try {
    console.log(`\n📝 Adding collection: ${name}`);
    const collections = await redis.get<Record<string, string>>(COLLECTION_KEY) || {};
    collections[name] = address;
    await redis.set(COLLECTION_KEY, collections);
    console.log('✅ Collection added successfully');
  } catch (error) {
    console.error('❌ Error adding collection:', error);
  }
}

// Add all known collections
async function addKnownCollections() {
  try {
    console.log('\n📝 Adding known collections...');
    const collections = await redis.get<Record<string, string>>(COLLECTION_KEY) || {};
    
    for (const collection of KNOWN_COLLECTIONS) {
      collections[collection.name] = collection.address;
      console.log(`Adding: ${collection.name}`);
    }
    
    await redis.set(COLLECTION_KEY, collections);
    console.log('✅ All known collections added successfully');
  } catch (error) {
    console.error('❌ Error adding known collections:', error);
  }
}

// Clear all collections
async function clearCollections() {
  try {
    console.log('\n🗑️  Clearing all collections...');
    await redis.del(COLLECTION_KEY);
    console.log('✅ Collections cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing collections:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add':
    if (args.length === 3) {
      addCollection(args[1], args[2]).then(() => process.exit(0));
    } else {
      console.log('Usage: npm run inspect-redis add "Collection Name" "0xaddress"');
    }
    break;
  case 'add-known':
    addKnownCollections().then(() => process.exit(0));
    break;
  case 'clear':
    clearCollections().then(() => process.exit(0));
    break;
  default:
    main();
} 