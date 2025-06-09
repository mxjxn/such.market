import { NextResponse } from 'next/server';
import { getCollectionNames } from '~/lib/kv';

// Cache duration in seconds (5 minutes)
const CACHE_DURATION = 300;

interface Suggestion {
  name: string;
  address: string;
  score?: number;
}

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
    const suggestions: Suggestion[] = [];
    const prefixLower = prefix.toLowerCase();
    console.log('📝 [Autocomplete] Processing prefix:', { prefix, prefixLower });

    // Get all known collection names from KV store
    console.log('🔑 [Autocomplete] Fetching collections...');
    const collections = await getCollectionNames();
    
    // Filter collections that match the prefix
    console.log('🔍 [Autocomplete] Filtering collections by prefix...');
    for (const [name, address] of Object.entries(collections)) {
      const nameLower = name.toLowerCase();
      const addressLower = address.toLowerCase();
      
      // Prioritize exact matches and prefix matches
      const isExactMatch = nameLower === prefixLower || addressLower === prefixLower;
      const isPrefixMatch = nameLower.startsWith(prefixLower) || addressLower.startsWith(prefixLower);
      const isPartialMatch = nameLower.includes(prefixLower) || addressLower.includes(prefixLower);
      
      if (isExactMatch || isPrefixMatch || isPartialMatch) {
        console.log('✅ [Autocomplete] Found matching collection:', { 
          name, 
          address,
          matchType: isExactMatch ? 'exact' : isPrefixMatch ? 'prefix' : 'partial'
        });
        suggestions.push({ 
          name, 
          address,
          score: isExactMatch ? 3 : isPrefixMatch ? 2 : 1
        });
      }
    }

    // Sort suggestions by score and then alphabetically
    suggestions.sort((a, b) => {
      if (a.score !== b.score) return (b.score || 0) - (a.score || 0);
      return a.name.localeCompare(b.name);
    });

    // Remove score from final response
    const finalSuggestions = suggestions
      .slice(0, 5)
      .map(({ name, address }) => ({ name, address }));

    console.log('🎯 [Autocomplete] Final suggestions:', { 
      count: finalSuggestions.length,
      suggestions: finalSuggestions 
    });

    // Create response with caching headers
    const response = NextResponse.json({
      suggestions: finalSuggestions
    });

    // Add cache control headers
    response.headers.set('Cache-Control', `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`);
    
    return response;
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