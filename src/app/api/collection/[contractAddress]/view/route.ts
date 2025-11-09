import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { redis, isRedisConfigured } from '~/lib/redis';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;
    
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // Get collection ID
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('contract_address', contractAddress.toLowerCase())
      .single();
    
    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    const collectionId = collection.id;
    const now = new Date();
    
    // Increment Redis counters for real-time tracking
    if (isRedisConfigured && redis) {
      const counter24h = `such-market:collections:${collectionId}:views:24h`;
      const counter7d = `such-market:collections:${collectionId}:views:7d`;
      const counter30d = `such-market:collections:${collectionId}:views:30d`;
      
      await Promise.all([
        redis.incr(counter24h),
        redis.incr(counter7d),
        redis.incr(counter30d),
      ]);
      
      // Set expiration on counters (24h, 7d, 30d)
      await Promise.all([
        redis.expire(counter24h, 86400), // 24 hours
        redis.expire(counter7d, 604800), // 7 days
        redis.expire(counter30d, 2592000), // 30 days
      ]);
    }
    
    // Update or insert engagement record
    const { data: engagement, error: engagementError } = await supabase
      .from('collection_engagement')
      .select('*')
      .eq('collection_id', collectionId)
      .single();
    
    if (engagementError && engagementError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected for new collections
      console.error('Error fetching engagement:', engagementError);
    }
    
    // Get current counts from Redis if available, otherwise use DB values
    let viewCount24h = engagement?.view_count_24h || 0;
    let viewCount7d = engagement?.view_count_7d || 0;
    let viewCount30d = engagement?.view_count_30d || 0;
    
    if (isRedisConfigured && redis) {
      const counter24h = `such-market:collections:${collectionId}:views:24h`;
      const counter7d = `such-market:collections:${collectionId}:views:7d`;
      const counter30d = `such-market:collections:${collectionId}:views:30d`;
      
      const [count24h, count7d, count30d] = await Promise.all([
        redis.get<number>(counter24h),
        redis.get<number>(counter7d),
        redis.get<number>(counter30d),
      ]);
      
      viewCount24h = count24h || viewCount24h;
      viewCount7d = count7d || viewCount7d;
      viewCount30d = count30d || viewCount30d;
    }
    
    // Calculate engagement score
    const engagementScore = (viewCount24h * 1.0) + (viewCount7d * 0.3) + (viewCount30d * 0.1);
    
    // Upsert engagement record
    const { error: upsertError } = await supabase
      .from('collection_engagement')
      .upsert({
        collection_id: collectionId,
        view_count_24h: viewCount24h,
        view_count_7d: viewCount7d,
        view_count_30d: viewCount30d,
        engagement_score: engagementScore,
        last_viewed_at: now.toISOString(),
      }, {
        onConflict: 'collection_id',
      });
    
    if (upsertError) {
      console.error('Error upserting engagement:', upsertError);
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in collection view POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

