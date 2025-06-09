import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { APP_NAME } from '~/lib/constants';

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function POST() {
  try {
    // Get all keys matching our app's pattern
    const keys = await redis.keys(`${APP_NAME}:*`);
    
    if (keys.length > 0) {
      // Delete all matching keys
      await redis.del(...keys);
      console.log('🗑️ Cleared Redis cache:', {
        keysDeleted: keys.length,
        pattern: `${APP_NAME}:*`,
      });
    }

    return NextResponse.json({
      success: true,
      keysDeleted: keys.length,
      message: `Successfully cleared ${keys.length} keys from Redis cache`,
    });
  } catch (error) {
    console.error('❌ Error clearing Redis cache:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear Redis cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 