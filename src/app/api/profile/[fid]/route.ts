import { NextRequest, NextResponse } from 'next/server';
import { getNeynarUser } from '~/lib/neynar';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;
    const fidNumber = parseInt(fid);
    
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'Invalid FID' },
        { status: 400 }
      );
    }

    // Check if Neynar API key is configured
    if (!process.env.NEYNAR_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Neynar API not configured',
          message: 'Profile data unavailable - API not configured'
        },
        { status: 503 }
      );
    }

    const user = await getNeynarUser(fidNumber);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return only the properties we know exist
    const profileData = {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      follower_count: user.follower_count,
      following_count: user.following_count,
      verifications: user.verifications,
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch profile data',
        message: 'Unable to load profile information'
      },
      { status: 500 }
    );
  }
} 