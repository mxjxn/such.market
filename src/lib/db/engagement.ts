import { getSupabaseClient } from '~/lib/supabase';
import { redis, isRedisConfigured } from '~/lib/redis';

/**
 * Get collection engagement data
 */
export async function getCollectionEngagement(collectionId: string) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('collection_engagement')
    .select('*')
    .eq('collection_id', collectionId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching collection engagement:', error);
    return null;
  }
  
  return data;
}

/**
 * Increment collection view count (uses Redis for real-time updates)
 */
export async function incrementCollectionView(collectionId: string) {
  if (isRedisConfigured && redis) {
    const counter24h = `such-market:collections:${collectionId}:views:24h`;
    const counter7d = `such-market:collections:${collectionId}:views:7d`;
    const counter30d = `such-market:collections:${collectionId}:views:30d`;
    
    await Promise.all([
      redis.incr(counter24h),
      redis.incr(counter7d),
      redis.incr(counter30d),
    ]);
    
    // Set expiration on counters
    await Promise.all([
      redis.expire(counter24h, 86400), // 24 hours
      redis.expire(counter7d, 604800), // 7 days
      redis.expire(counter30d, 2592000), // 30 days
    ]);
  }
}

/**
 * Get view counts from Redis (for real-time display)
 */
export async function getCollectionViewCounts(collectionId: string) {
  if (!isRedisConfigured || !redis) {
    return { viewCount24h: 0, viewCount7d: 0, viewCount30d: 0 };
  }
  
  const counter24h = `such-market:collections:${collectionId}:views:24h`;
  const counter7d = `such-market:collections:${collectionId}:views:7d`;
  const counter30d = `such-market:collections:${collectionId}:views:30d`;
  
  const [count24h, count7d, count30d] = await Promise.all([
    redis.get<number>(counter24h) || 0,
    redis.get<number>(counter7d) || 0,
    redis.get<number>(counter30d) || 0,
  ]);
  
  return {
    viewCount24h: count24h || 0,
    viewCount7d: count7d || 0,
    viewCount30d: count30d || 0,
  };
}

/**
 * Calculate engagement score
 */
export function calculateEngagementScore(
  viewCount24h: number,
  viewCount7d: number,
  viewCount30d: number
): number {
  return (viewCount24h * 1.0) + (viewCount7d * 0.3) + (viewCount30d * 0.1);
}

/**
 * Sync Redis counters to database (should be called periodically)
 */
export async function syncEngagementToDatabase(collectionId: string) {
  const supabase = getSupabaseClient();
  
  // Get counts from Redis
  const { viewCount24h, viewCount7d, viewCount30d } = await getCollectionViewCounts(collectionId);
  
  // Calculate engagement score
  const engagementScore = calculateEngagementScore(viewCount24h, viewCount7d, viewCount30d);
  
  // Update database
  const { error } = await supabase
    .from('collection_engagement')
    .upsert({
      collection_id: collectionId,
      view_count_24h: viewCount24h,
      view_count_7d: viewCount7d,
      view_count_30d: viewCount30d,
      engagement_score: engagementScore,
      last_viewed_at: new Date().toISOString(),
    }, {
      onConflict: 'collection_id',
    });
  
  if (error) {
    console.error('Error syncing engagement to database:', error);
    throw error;
  }
}

