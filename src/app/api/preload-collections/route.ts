import { NextResponse } from 'next/server';
import { addCollectionName, getCollectionNames } from '~/lib/kv';
import { preloadedCollections } from '../../../../config/preloaded-collections';
import { Alchemy, Network } from 'alchemy-sdk';

// Initialize Alchemy SDK
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

export async function GET() {
  try {
    // Get existing collections from KV store
    const existingCollections = await getCollectionNames();
    console.log('📚 Existing collections:', { count: Object.keys(existingCollections).length });

    // Process preloaded collections
    for (const collection of preloadedCollections) {
      try {
        // Only add if not already in store
        if (!existingCollections[collection.name]) {
          console.log('➕ Adding preloaded collection:', { 
            name: collection.name, 
            address: collection.contractAddress 
          });
          await addCollectionName(collection.name, collection.contractAddress);
        }

        // Fetch and cache metadata for better search results
        const metadata = await alchemy.nft.getContractMetadata(collection.contractAddress);
        if (metadata.name && metadata.name !== collection.name) {
          console.log('➕ Adding alternative name:', { 
            name: metadata.name, 
            address: collection.contractAddress 
          });
          await addCollectionName(metadata.name, collection.contractAddress);
        }
      } catch (error) {
        console.error('⚠️ Error processing collection:', {
          collection: collection.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get updated collection count
    const updatedCollections = await getCollectionNames();
    console.log('✅ Preload complete:', { 
      before: Object.keys(existingCollections).length,
      after: Object.keys(updatedCollections).length
    });

    return NextResponse.json({
      success: true,
      collections: updatedCollections
    });
  } catch (error) {
    console.error('❌ Preload error:', error);
    return NextResponse.json(
      { error: 'Failed to preload collections' },
      { status: 500 }
    );
  }
} 