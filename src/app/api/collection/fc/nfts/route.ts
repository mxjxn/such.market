import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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
  address: string;
}

interface AlchemyNFT {
  contract: {
    address: string;
  };
  id: {
    tokenId: string;
    tokenMetadata: {
      tokenType: string;
    };
  };
  title: string;
  description: string;
  tokenUri: {
    raw: string;
    gateway: string;
  };
  media: Array<{
    raw: string;
    gateway: string;
    thumbnail: string;
    format: string;
    bytes: number;
  }>;
  metadata: {
    name: string;
    description: string;
    image: string;
    external_url: string;
    attributes: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  timeLastUpdated: string;
}

interface AlchemyNFTsResponse {
  ownedNfts: AlchemyNFT[];
  totalCount: number;
  pageKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const { contractAddress, collectionId, fcUsers } = await request.json();

    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    if (!fcUsers || !Array.isArray(fcUsers) || fcUsers.length === 0) {
      return NextResponse.json(
        { error: 'Farcaster users array is required' },
        { status: 400 }
      );
    }

    if (!process.env.ALCHEMY_API_KEY) {
      return NextResponse.json(
        { error: 'Alchemy API key not configured' },
        { status: 500 }
      );
    }

    console.log(`🖼️ [FC NFTs] Getting NFTs for ${fcUsers.length} Farcaster users from ${contractAddress}`);

    const supabase = getSupabaseClient();
    const allNFTs: Array<{
      id: string;
      collection_id: string;
      token_id: string;
      title: string | null;
      description: string | null;
      image_url: string | null;
      thumbnail_url: string | null;
      metadata: Record<string, unknown> | null;
      attributes: Array<{ trait_type: string; value: string | number }> | null;
      media: Array<{
        raw: string;
        gateway: string;
        thumbnail: string;
        format: string;
        bytes: number;
      }> | null;
      owner_address: string;
      last_owner_check_at: string;
      created_at: string;
      updated_at: string;
    }> = [];
    const now = new Date().toISOString();

    // Process each Farcaster user
    for (const user of fcUsers as FarcasterUser[]) {
      try {
        // Use the address that was passed in (could be custody or verified address)
        const userAddress = user.address;
        
        console.log(`🔄 [FC NFTs] Getting NFTs for user ${user.username} (${userAddress})`);

        // Call Alchemy's getNFTsForOwner API
        const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getNFTsForOwner`;
        const params = new URLSearchParams({
          owner: userAddress,
          'contractAddresses[]': contractAddress,
          withMetadata: 'true',
          pageSize: '100'
        });

        const response = await fetch(`${alchemyUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`❌ [FC NFTs] Alchemy API error for ${userAddress}: ${response.status}`);
          continue;
        }

        const data: AlchemyNFTsResponse = await response.json();
        
        if (data.ownedNfts && data.ownedNfts.length > 0) {
          console.log(`✅ [FC NFTs] Found ${data.ownedNfts.length} NFTs for ${user.username}`);
          
          // Process each NFT
          for (const nft of data.ownedNfts) {
            const nftData = {
              id: uuidv4(),
              collection_id: collectionId,
              token_id: nft.id.tokenId,
              title: nft.title || nft.metadata?.name || `NFT #${nft.id.tokenId}`,
              description: nft.description || nft.metadata?.description || null,
              image_url: nft.media?.[0]?.gateway || nft.metadata?.image || null,
              thumbnail_url: nft.media?.[0]?.thumbnail || null,
              metadata: nft.metadata || null,
              attributes: nft.metadata?.attributes || null,
              media: nft.media || null,
              owner_address: userAddress,
              last_owner_check_at: now,
              created_at: now,
              updated_at: now,
            };

            allNFTs.push(nftData);
          }
        } else {
          console.log(`ℹ️ [FC NFTs] No NFTs found for ${user.username}`);
        }

      } catch (error) {
        console.error(`❌ [FC NFTs] Error processing user ${user.username}:`, error);
        continue;
      }
    }

    // Store all NFTs in database
    if (allNFTs.length > 0) {
      console.log(`💾 [FC NFTs] Storing ${allNFTs.length} NFTs in database`);
      
      const { error: upsertError } = await supabase
        .from('nfts')
        .upsert(allNFTs, {
          onConflict: 'collection_id,token_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('❌ [FC NFTs] Error upserting NFTs:', upsertError);
        return NextResponse.json(
          { error: 'Failed to store NFTs' },
          { status: 500 }
        );
      }

      console.log(`✅ [FC NFTs] Successfully stored ${allNFTs.length} NFTs`);
    }

    return NextResponse.json({
      nfts: allNFTs,
      total: allNFTs.length,
      processedUsers: fcUsers.length
    });

  } catch (error) {
    console.error('Error in FC NFTs endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 