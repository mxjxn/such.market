import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

interface FarcasterUser {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  profile: {
    bio: {
      text: string;
      mentioned_channels?: Array<{
        object: string;
        id: string;
        name: string;
        image_url: string;
      }>;
    };
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary: {
      eth_address: string;
      sol_address: string;
    };
  };
  verified_accounts: Array<{
    platform: string;
    username: string;
  }>;
  power_badge: boolean;
  viewer_context: {
    following: boolean;
    followed_by: boolean;
    blocking: boolean;
    blocked_by: boolean;
  };
  experimental: {
    neynar_user_score: number;
    deprecation_notice: string;
  };
  score: number;
}

interface NeynarResponse {
  [address: string]: FarcasterUser[];
}

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: 'Invalid addresses array' },
        { status: 400 }
      );
    }

    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    console.log(`👥 [FC Users] Getting Farcaster users for ${addresses.length} addresses`);

    // Call Neynar's bulk API
    const neynarUrl = 'https://api.neynar.com/v2/farcaster/user/bulk-by-address/';
    const addressesParam = addresses.join(',');
    
    const response = await fetch(`${neynarUrl}?addresses=${addressesParam}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.NEYNAR_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [FC Users] Neynar API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch users from Neynar' },
        { status: response.status }
      );
    }

    const data: NeynarResponse = await response.json();
    
    // Process the response and store users in database
    const supabase = getSupabaseClient();
    const fcUsers: Array<FarcasterUser & { address: string }> = [];

    for (const [address, users] of Object.entries(data)) {
      if (users && users.length > 0) {
        for (const user of users) {
          // Store user in database if not already there
          const { error: upsertError } = await supabase
            .from('fc_users')
            .upsert({
              fid: user.fid,
              username: user.username,
              display_name: user.display_name,
              pfp_url: user.pfp_url,
              custody_address: user.custody_address,
              verified_addresses: user.verified_addresses,
              follower_count: user.follower_count,
              following_count: user.following_count,
              power_badge: user.power_badge,
              score: user.score,
              profile: user.profile,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'fid',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.error(`❌ [FC Users] Error upserting user ${user.fid}:`, upsertError);
          } else {
            console.log(`✅ [FC Users] Stored/updated user ${user.username} (FID: ${user.fid})`);
          }

          fcUsers.push({ ...user, address });
        }
      }
    }

    console.log(`✅ [FC Users] Found ${fcUsers.length} Farcaster users from ${Object.keys(data).length} addresses`);
    
    return NextResponse.json({
      fcUsers,
      total: fcUsers.length,
      addressesWithUsers: Object.keys(data).length
    });

  } catch (error) {
    console.error('Error in FC users endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 