import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    
    // First, get manually featured collections
    const { data: featuredCollections, error: featuredError } = await supabase
      .from('collections')
      .select('id, contract_address, name, featured')
      .eq('featured', true)
      .limit(limit);
    
    if (featuredError) {
      console.error('Error fetching featured collections:', featuredError);
    }
    
    const featuredCount = featuredCollections?.length || 0;
    const remainingLimit = limit - featuredCount;
    
    let algorithmCollections: any[] = [];
    
    // If we need more, get algorithmically determined collections by engagement score
    if (remainingLimit > 0) {
      const { data: engagementData, error: engagementError } = await supabase
        .from('collection_engagement')
        .select(`
          collection_id,
          engagement_score,
          collections!inner(id, contract_address, name, featured)
        `)
        .order('engagement_score', { ascending: false })
        .limit(remainingLimit);
      
      if (!engagementError && engagementData) {
        algorithmCollections = engagementData.map((item: any) => ({
          id: item.collections.id,
          contract_address: item.collections.contract_address,
          name: item.collections.name,
          featured: item.collections.featured,
          engagement_score: item.engagement_score,
        }));
      }
    }
    
    // Combine featured and algorithmic collections
    const allCollections = [
      ...(featuredCollections || []).map((c: any) => ({ ...c, source: 'featured' })),
      ...algorithmCollections.map((c: any) => ({ ...c, source: 'algorithm' })),
    ];
    
    // Fetch additional metadata (image_url, floor_price, volume) if needed
    // For now, return basic collection data
    const collections = allCollections.map((collection: any) => ({
      id: collection.id,
      contract_address: collection.contract_address,
      name: collection.name,
      featured: collection.featured || false,
      image_url: null, // TODO: Add collection image_url to collections table or fetch from metadata
      floor_price: null, // TODO: Calculate from listings
      volume_24h: null, // TODO: Calculate from fulfillments
    }));
    
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Error in featured collections GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

