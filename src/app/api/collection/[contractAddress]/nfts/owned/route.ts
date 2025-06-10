import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { getCollectionByAddress, fetchAndStoreCollectionMetadata } from '~/lib/db/collections';
import { v4 as uuidv4 } from 'uuid';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Validate contract address
    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Validate user address
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Owned NFTs] Getting NFTs owned by ${userAddress} in collection ${contractAddress}`);

    // Step 1: Check if collection exists in database
    let collection = await getCollectionByAddress(contractAddress.toLowerCase());
    
    if (!collection) {
      console.log(`🔄 [Owned NFTs] Collection not found in database, fetching metadata...`);
      
      try {
        // Try to fetch and store collection metadata
        collection = await fetchAndStoreCollectionMetadata(contractAddress);
        
        if (!collection) {
          console.error(`❌ [Owned NFTs] Failed to fetch collection metadata`);
          return NextResponse.json(
            { error: 'Collection not found and could not be fetched' },
            { status: 404 }
          );
        }
        
        console.log(`✅ [Owned NFTs] Collection metadata fetched and stored:`, {
          id: collection.id,
          name: collection.name,
        });
      } catch (error) {
        console.error(`❌ [Owned NFTs] Failed to fetch collection metadata:`, error);
        return NextResponse.json(
          { error: 'Failed to fetch collection metadata' },
          { status: 404 }
        );
      }
    }

    // Step 2: Check if we have recent ownership data for this user
    const supabase = getSupabaseClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNFTs, error: recentError, count } = await supabase
      .from('nfts')
      .select('*', { count: 'exact' })
      .eq('collection_id', collection.id)
      .eq('owner_address', userAddress.toLowerCase())
      .gte('last_owner_check_at', twentyFourHoursAgo)
      .order('token_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (recentError) {
      console.error('Error fetching recent owned NFTs:', recentError);
      return NextResponse.json(
        { error: 'Failed to fetch recent owned NFTs' },
        { status: 500 }
      );
    }

    // If we have recent data, return it
    if (recentNFTs && recentNFTs.length > 0) {
      console.log(`✅ [Owned NFTs] Returning ${recentNFTs.length} recent NFTs owned by ${userAddress}`);
      return NextResponse.json({
        nfts: recentNFTs,
        total: count || 0,
        page,
        pageSize,
        hasMore: (count || 0) > (page + 1) * pageSize,
        isFresh: true
      });
    }

    // Step 3: If no recent data, try to fetch fresh ownership data from Alchemy
    console.log(`🔄 [Owned NFTs] No recent data found, fetching fresh ownership data for ${userAddress}`);
    
    try {
      // Call Alchemy's getNFTsForOwner API
      const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getNFTsForOwner`;
      const alchemyParams = new URLSearchParams({
        owner: userAddress,
        'contractAddresses[]': contractAddress,
        withMetadata: 'true',
        pageSize: '100'
      });

      const response = await fetch(`${alchemyUrl}?${alchemyParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`❌ [Owned NFTs] Alchemy API error for ${userAddress}: ${response.status}`);
        // Return empty result if Alchemy fails
        return NextResponse.json({
          nfts: [],
          total: 0,
          page,
          pageSize,
          hasMore: false,
          isFresh: false,
          message: 'Failed to fetch fresh ownership data'
        });
      }

      const data: AlchemyNFTsResponse = await response.json();
      const now = new Date().toISOString();
      
      // Debug: Log the first NFT structure to understand the actual response format
      if (data.ownedNfts && data.ownedNfts.length > 0) {
        console.log(`🔍 [Owned NFTs] Debug - First NFT structure:`, {
          firstNFT: data.ownedNfts[0],
          keys: Object.keys(data.ownedNfts[0]),
          idType: typeof data.ownedNfts[0].id,
          idKeys: data.ownedNfts[0].id ? Object.keys(data.ownedNfts[0].id) : 'id is null/undefined'
        });
      }
      
      if (data.ownedNfts && data.ownedNfts.length > 0) {
        console.log(`✅ [Owned NFTs] Found ${data.ownedNfts.length} NFTs owned by ${userAddress}`);
        
        // Process and store the NFTs with safer property access
        const nftData = data.ownedNfts.map((nft: unknown) => {
          const nftObj = nft as Record<string, unknown>;
          
          // Handle different possible token ID structures
          let tokenId: string;
          if (nftObj.id && typeof nftObj.id === 'object' && nftObj.id && 'tokenId' in nftObj.id) {
            tokenId = String((nftObj.id as Record<string, unknown>).tokenId);
          } else if (nftObj.id && typeof nftObj.id === 'string') {
            tokenId = nftObj.id;
          } else if (nftObj.tokenId) {
            tokenId = String(nftObj.tokenId);
          } else {
            console.warn(`⚠️ [Owned NFTs] Could not extract token ID from NFT:`, nftObj);
            tokenId = 'unknown';
          }

          const metadata = nftObj.metadata as Record<string, unknown> | undefined;
          const media = nftObj.media as Array<Record<string, unknown>> | undefined;
          const image = nftObj.image as Record<string, unknown> | undefined;

          // Debug: Log title mapping for first NFT
          const title = String(nftObj.name || nftObj.title || metadata?.name || `NFT #${tokenId}`);
          if (data.ownedNfts.indexOf(nft as AlchemyNFT) === 0) {
            console.log(`🔍 [Owned NFTs] Title mapping debug:`, {
              nftObjName: nftObj.name,
              nftObjTitle: nftObj.title,
              metadataName: metadata?.name,
              fallbackTitle: `NFT #${tokenId}`,
              finalTitle: title
            });
          }

          return {
            id: uuidv4(),
            collection_id: collection.id,
            token_id: tokenId,
            title: title,
            description: nftObj.description || metadata?.description || null,
            image_url: image?.cachedUrl || media?.[0]?.gateway || metadata?.image || null,
            thumbnail_url: image?.thumbnailUrl || media?.[0]?.thumbnail || null,
            metadata: metadata || null,
            attributes: metadata?.attributes || null,
            media: media || null,
            owner_address: userAddress.toLowerCase(),
            last_owner_check_at: now,
            created_at: now,
            updated_at: now,
          };
        });

        // Store NFTs in database
        const { error: upsertError } = await supabase
          .from('nfts')
          .upsert(nftData, {
            onConflict: 'collection_id,token_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('❌ [Owned NFTs] Error upserting NFTs:', upsertError);
          return NextResponse.json(
            { error: 'Failed to store owned NFTs' },
            { status: 500 }
          );
        }

        console.log(`✅ [Owned NFTs] Successfully stored ${nftData.length} NFTs`);

        // Return the paginated results
        const paginatedNFTs = nftData.slice(page * pageSize, (page + 1) * pageSize);
        return NextResponse.json({
          nfts: paginatedNFTs,
          total: nftData.length,
          page,
          pageSize,
          hasMore: nftData.length > (page + 1) * pageSize,
          isFresh: true
        });
      } else {
        console.log(`ℹ️ [Owned NFTs] No NFTs found for ${userAddress}`);
        return NextResponse.json({
          nfts: [],
          total: 0,
          page,
          pageSize,
          hasMore: false,
          isFresh: true
        });
      }
    } catch (error) {
      console.error(`❌ [Owned NFTs] Error fetching from Alchemy:`, error);
      return NextResponse.json({
        nfts: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
        isFresh: false,
        message: 'Failed to fetch fresh ownership data'
      });
    }

  } catch (error) {
    console.error('Error in owned NFTs endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 