import { NextResponse } from 'next/server';
import { createOfferOrder, getOrderHash } from '~/lib/seaport/orders';
import type { CreateOfferRequest, CreateOfferResponse } from '~/lib/seaport/types';
import { getSupabaseClient } from '~/lib/supabase';
import { getCollectionByAddress } from '~/lib/db/collections';
import { getSession } from '~/auth';

/**
 * POST /api/seaport/offers/create
 * 
 * Creates a Seaport offer order for an NFT
 * 
 * Request body:
 * {
 *   contractAddress: string;
 *   tokenId: string;
 *   offerAmountEth: string;
 *   offererAddress: string;
 *   durationDays?: number;
 * }
 */
export async function POST(request: Request) {
  try {
    const body: CreateOfferRequest = await request.json();
    
    // Validate required fields
    if (!body.contractAddress || !body.tokenId || !body.offerAmountEth || !body.offererAddress) {
      return NextResponse.json<CreateOfferResponse>(
        {
          success: false,
          orderComponents: {} as any,
          orderHash: '',
          error: 'Missing required fields: contractAddress, tokenId, offerAmountEth, offererAddress',
        },
        { status: 400 }
      );
    }
    
    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.contractAddress)) {
      return NextResponse.json<CreateOfferResponse>(
        {
          success: false,
          orderComponents: {} as any,
          orderHash: '',
          error: 'Invalid contract address format',
        },
        { status: 400 }
      );
    }
    
    // Validate offerer address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.offererAddress)) {
      return NextResponse.json<CreateOfferResponse>(
        {
          success: false,
          orderComponents: {} as any,
          orderHash: '',
          error: 'Invalid offerer address format',
        },
        { status: 400 }
      );
    }
    
    // Validate offer amount
    const offerAmount = parseFloat(body.offerAmountEth);
    if (isNaN(offerAmount) || offerAmount <= 0) {
      return NextResponse.json<CreateOfferResponse>(
        {
          success: false,
          orderComponents: {} as any,
          orderHash: '',
          error: 'Invalid offer amount. Must be a positive number.',
        },
        { status: 400 }
      );
    }
    
    // Get collection and NFT info
    const collection = await getCollectionByAddress(body.contractAddress.toLowerCase());
    if (!collection) {
      return NextResponse.json<CreateOfferResponse>(
        {
          success: false,
          orderComponents: {} as any,
          orderHash: '',
          error: 'Collection not found',
        },
        { status: 404 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // Get NFT info
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .select('id, owner_address')
      .eq('collection_id', collection.id)
      .eq('token_id', body.tokenId)
      .single();
    
    // Get owner address (from NFT record or we'll need to fetch on-chain)
    const ownerAddress = nft?.owner_address || null;
    
    // Get FC user ID for offerer (if authenticated)
    const session = await getSession();
    const offererFid = session?.user?.fid || null;
    
    // Get FC user ID for NFT owner (if they have a Farcaster account)
    let ownerFid: number | null = null;
    if (ownerAddress) {
      const { data: ownerUser } = await supabase
        .from('fc_users')
        .select('fid')
        .contains('verified_addresses', [ownerAddress.toLowerCase()])
        .single();
      
      ownerFid = ownerUser?.fid || null;
    }
    
    // Create the offer order
    const orderComponents = await createOfferOrder(
      body.offererAddress,
      body.contractAddress.toLowerCase(),
      body.tokenId,
      body.offerAmountEth,
      body.durationDays
    );
    
    // Calculate order hash
    const orderHash = getOrderHash(orderComponents);
    
    // Extract salt from order components
    const salt = orderComponents.salt;
    const startTime = parseInt(orderComponents.startTime);
    const endTime = parseInt(orderComponents.endTime);
    const counter = parseInt(orderComponents.counter);
    
    // Store order in database
    const { data: storedOrder, error: orderError } = await supabase
      .from('seaport_orders')
      .insert({
        order_hash: orderHash,
        offerer_address: body.offererAddress.toLowerCase(),
        order_type: 'offer',
        status: 'active',
        start_time: new Date(startTime * 1000).toISOString(),
        end_time: new Date(endTime * 1000).toISOString(),
        salt: salt,
        conduit_key: orderComponents.conduitKey,
        zone_hash: orderComponents.zoneHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        counter: counter,
        offer_items: orderComponents.offer,
        consideration_items: orderComponents.consideration,
        fc_user_id: offererFid,
      })
      .select()
      .single();
    
    if (orderError || !storedOrder) {
      console.error('Error storing order:', orderError);
      // Don't fail the request, just log the error
    } else {
      // Store order items
      const orderItems = [
        // Offer items (what the offerer is offering - ETH)
        ...orderComponents.offer.map((item) => ({
          order_id: storedOrder.id,
          item_type: 'offer',
          token_type: item.itemType,
          token_address: item.token,
          token_id: item.identifierOrCriteria,
          amount: item.startAmount,
          start_amount: item.startAmount,
          end_amount: item.endAmount,
        })),
        // Consideration items (what the offerer wants - NFT)
        ...orderComponents.consideration.map((item) => ({
          order_id: storedOrder.id,
          item_type: 'consideration',
          token_type: item.itemType,
          token_address: item.token,
          token_id: item.identifierOrCriteria,
          amount: item.startAmount,
          recipient_address: item.recipient,
          start_amount: item.startAmount,
          end_amount: item.endAmount,
          collection_id: collection.id,
          nft_id: nft?.id || null,
        })),
      ];
      
      const { error: itemsError } = await supabase
        .from('seaport_order_items')
        .insert(orderItems);
      
      if (itemsError) {
        console.error('Error storing order items:', itemsError);
      }
      
      // Create notification for NFT owner if they have a Farcaster account
      if (ownerFid && nft) {
        const { error: notificationError } = await supabase
          .from('seaport_notifications')
          .insert({
            fc_user_id: ownerFid,
            order_id: storedOrder.id,
            notification_type: 'offer_received',
            message: `You received an offer of ${body.offerAmountEth} ETH for ${collection.name} #${body.tokenId}`,
            is_read: false,
          });
        
        if (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }
    }
    
    return NextResponse.json<CreateOfferResponse>({
      success: true,
      orderComponents,
      orderHash,
      message: 'Offer order created successfully. Please sign the order with your wallet.',
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    
    return NextResponse.json<CreateOfferResponse>(
      {
        success: false,
        orderComponents: {} as any,
        orderHash: '',
        error: error instanceof Error ? error.message : 'Failed to create offer order',
      },
      { status: 500 }
    );
  }
}

