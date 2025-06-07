import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Cache keys
const REFRESH_LOCK_KEY = (contractAddress: string) => 
  `nft:collection:${contractAddress}:refresh:lock`;
const COLLECTION_INDEX_KEY = (contractAddress: string) => 
  `nft:collection:${contractAddress}:index`;
const PAGE_KEY = (contractAddress: string, pageNumber: number) => 
  `nft:collection:${contractAddress}:page:${pageNumber}`;

// Rate limit settings
const REFRESH_COOLDOWN = 1800; // 30 minutes in seconds

export async function POST(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  const { contractAddress } = params;
  
  console.log('🔄 Cache Refresh Request:', {
    url: request.url,
    method: request.method,
    contractAddress,
  });
  
  try {
    // Validate contract address
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      console.log('❌ Invalid contract address:', contractAddress);
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Check if refresh is locked
    const lockExpiry = await redis.get<number>(REFRESH_LOCK_KEY(contractAddress));
    const now = Math.floor(Date.now() / 1000);
    
    if (lockExpiry && lockExpiry > now) {
      const remainingTime = Math.ceil((lockExpiry - now) / 60); // Convert to minutes
      return NextResponse.json(
        { 
          error: 'Refresh is rate limited',
          message: `Please wait ${remainingTime} minutes before refreshing again`,
          nextRefreshTime: new Date(lockExpiry * 1000).toISOString(),
        },
        { status: 429 }
      );
    }

    // Set refresh lock
    await redis.set(
      REFRESH_LOCK_KEY(contractAddress),
      now + REFRESH_COOLDOWN,
      { ex: REFRESH_COOLDOWN }
    );

    // Delete all cached pages and collection index
    const keys = await redis.keys(`nft:collection:${contractAddress}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    console.log('🔄 Manual refresh initiated:', {
      contractAddress,
      clearedKeys: keys.length,
      nextRefreshTime: new Date((now + REFRESH_COOLDOWN) * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Collection refresh initiated',
      nextRefreshTime: new Date((now + REFRESH_COOLDOWN) * 1000).toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in refresh endpoint:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to refresh collection' },
      { status: 500 }
    );
  }
}

// Add GET endpoint to check refresh status
export async function GET(
  request: Request,
  context: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await context.params;
    const lockExpiry = await redis.get<number>(REFRESH_LOCK_KEY(contractAddress));
    const now = Math.floor(Date.now() / 1000);
    
    const canRefresh = !lockExpiry || lockExpiry <= now;
    const nextRefreshTime = lockExpiry ? new Date(lockExpiry * 1000).toISOString() : null;
    
    return NextResponse.json({
      canRefresh,
      nextRefreshTime,
      remainingTime: lockExpiry ? Math.ceil((lockExpiry - now) / 60) : 0, // in minutes
    });
  } catch (error) {
    console.error('❌ Error checking refresh status:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress: (await context.params).contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to check refresh status' },
      { status: 500 }
    );
  }
} 