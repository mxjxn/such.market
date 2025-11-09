import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { getCachedData, setCachedData, CACHE_KEYS, REDIS_CONFIG } from '~/lib/redis';

/**
 * GET /api/profile/[fid]/collections
 * 
 * Returns user's collections prioritized by engagement score
 * Priority calculation:
 * score = (user_token_count * 0.4) + (collection_engagement_score * 0.3) + (is_featured * 0.2) + (recent_activity * 0.1)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    
    // Check cache first
    const cacheKey = CACHE_KEYS.userPrioritizedCollections(parseInt(fid));
    const cached = await getCachedData<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ collections: cached });
    }
    
    const supabase = getSupabaseClient();
    
    // Get user's verified addresses
    const { data: userData, error: userError } = await supabase
      .from('fc_users')
      .select('verified_addresses')
      .eq('fid', parseInt(fid))
      .single();
    
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const verifiedAddresses = (userData.verified_addresses as string[]) || [];
    if (verifiedAddresses.length === 0) {
      return NextResponse.json({ collections: [] });
    }
    
    // Get all collections user owns NFTs from
    const { data: walletMappings, error: mappingError } = await supabase
      .from('wallet_collection_mapping')
      .select(`
        collection_address,
        token_count,
        collections!inner(
          id,
          contract_address,
          name,
          featured
        )
      `)
      .in('wallet_address', verifiedAddresses.map(addr => addr.toLowerCase()));
    
    if (mappingError) {
      console.error('Error fetching wallet collections:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch collections' },
        { status: 500 }
      );
    }
    
    if (!walletMappings || walletMappings.length === 0) {
      return NextResponse.json({ collections: [] });
    }
    
    // Get collection IDs
    const collectionIds = walletMappings.map((m: any) => m.collections.id);
    
    // Get engagement scores for these collections
    const { data: engagementData, error: engagementError } = await supabase
      .from('collection_engagement')
      .select('collection_id, engagement_score')
      .in('collection_id', collectionIds);
    
    const engagementMap = new Map(
      (engagementData || []).map((e: any) => [e.collection_id, e.engagement_score || 0])
    );
    
    // Calculate priority scores
    const collectionsWithScores = walletMappings.map((mapping: any) => {
      const collection = mapping.collections;
      const tokenCount = mapping.token_count || 0;
      const engagementScore = engagementMap.get(collection.id) || 0;
      const isFeatured = collection.featured || false;
      
      // Priority score calculation
      const score = (
        tokenCount * 0.4 +
        engagementScore * 0.3 +
        (isFeatured ? 1 : 0) * 0.2 * 1000 + // Scale featured bonus
        0.1 // Placeholder for recent activity
      );
      
      return {
        id: collection.id,
        contract_address: collection.contract_address,
        name: collection.name,
        token_count: tokenCount,
        featured: isFeatured,
        engagement_score: engagementScore,
        priority_score: score,
      };
    });
    
    // Sort by priority score descending
    collectionsWithScores.sort((a, b) => b.priority_score - a.priority_score);
    
    // Return top N collections
    const topCollections = collectionsWithScores.slice(0, limit);
    
    // Cache the result
    await setCachedData(cacheKey, topCollections, REDIS_CONFIG.ttl.hot);
    
    return NextResponse.json({ collections: topCollections });
  } catch (error) {
    console.error('Error in profile collections GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

