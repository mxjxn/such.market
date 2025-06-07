import { Alchemy, Network } from 'alchemy-sdk';
import { NextResponse } from 'next/server';
import { getCollectionNames } from '~/lib/kv';

// Initialize Alchemy SDK on the server side
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix');

  console.log('🔍 [Autocomplete] Request received:', { prefix });

  if (!prefix) {
    console.log('❌ [Autocomplete] No prefix provided');
    return NextResponse.json(
      { error: 'Prefix parameter is required' },
      { status: 400 }
    );
  }

  try {
    const suggestions: { name: string; address: string }[] = [];
    const prefixLower = prefix.toLowerCase();
    console.log('📝 [Autocomplete] Processing prefix:', { prefix, prefixLower });

    // Get all known collection names from KV store
    console.log('🔑 [Autocomplete] Fetching collections...');
    const collections = await getCollectionNames();
    console.log('📚 [Autocomplete] Retrieved collections:', { 
      count: Object.keys(collections).length,
      collections: Object.entries(collections),
      raw: collections
    });
    
    // Filter collections that match the prefix
    console.log('🔍 [Autocomplete] Filtering collections by prefix...');
    for (const [name, address] of Object.entries(collections)) {
      const nameLower = name.toLowerCase();
      const addressLower = address.toLowerCase();
      const matches = nameLower.includes(prefixLower) || addressLower.includes(prefixLower);
      
      if (matches) {
        console.log('✅ [Autocomplete] Found matching collection:', { 
          name, 
          address,
          matches: {
            nameMatch: nameLower.includes(prefixLower),
            addressMatch: addressLower.includes(prefixLower)
          }
        });
        suggestions.push({ name, address });
      }
    }
    console.log('📊 [Autocomplete] Collection matches:', { 
      count: suggestions.length,
      suggestions 
    });

    // If it looks like an ENS name, add it as a suggestion
    if (prefixLower.endsWith('.eth') || prefixLower.includes('.eth')) {
      console.log('🌐 Adding ENS suggestion:', { prefix });
      suggestions.push({
        name: prefix,
        address: prefix // Will be resolved to address when selected
      });
    }

    // If it looks like a contract address, add it as a suggestion
    if (prefixLower.startsWith('0x') && prefixLower.length >= 4) {
      console.log('🔗 Checking contract address:', { prefix });
      try {
        const metadata = await alchemy.nft.getContractMetadata(prefixLower);
        if (metadata.name) {
          console.log('✅ Found contract metadata:', { 
            name: metadata.name,
            address: prefixLower 
          });
          suggestions.push({
            name: metadata.name,
            address: prefixLower
          });
        }
      } catch (error) {
        console.log('⚠️ Error fetching contract metadata:', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          prefix 
        });
        // If it's a partial address, still add it as a suggestion
        if (prefixLower.length < 42) {
          console.log('📝 Adding partial address suggestion:', { prefix });
          suggestions.push({
            name: `Address: ${prefixLower}...`,
            address: prefixLower
          });
        }
      }
    }

    // Sort suggestions by relevance
    console.log('🔄 [Autocomplete] Sorting suggestions...');
    suggestions.sort((a, b) => {
      const aNameLower = a.name.toLowerCase();
      const bNameLower = b.name.toLowerCase();
      const aStartsWith = aNameLower.startsWith(prefixLower);
      const bStartsWith = bNameLower.startsWith(prefixLower);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return aNameLower.localeCompare(bNameLower);
    });

    const finalSuggestions = suggestions.slice(0, 5);
    console.log('🎯 [Autocomplete] Final suggestions:', { 
      count: finalSuggestions.length,
      suggestions: finalSuggestions 
    });

    return NextResponse.json({
      suggestions: finalSuggestions
    });
  } catch (error) {
    console.error('❌ [Autocomplete] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
} 