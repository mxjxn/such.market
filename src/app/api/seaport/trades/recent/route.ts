import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    
    // Get recent fulfillments with order and collection data
    const { data: fulfillments, error } = await supabase
      .from('seaport_fulfillments')
      .select(`
        id,
        transaction_hash,
        created_at,
        seaport_orders!inner(
          id,
          order_type,
          offerer_address,
          seaport_order_items!inner(
            id,
            item_type,
            token_type,
            token_address,
            token_id,
            amount,
            collection_id,
            nft_id,
            collections!inner(
              id,
              contract_address,
              name
            ),
            nfts(
              id,
              image_url
            )
          )
        )
      `)
      .eq('seaport_orders.status', 'fulfilled')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching recent trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recent trades' },
        { status: 500 }
      );
    }
    
    // Transform the data into a more usable format
    const trades = fulfillments?.map((fulfillment: any) => {
      const order = fulfillment.seaport_orders;
      
      // Find the NFT consideration item (what was sold)
      const nftItem = order.seaport_order_items?.find(
        (item: any) => item.item_type === 'consideration' && item.token_type === 2 // ERC721
      );
      
      // Find the payment offer item (what was paid)
      const paymentItem = order.seaport_order_items?.find(
        (item: any) => item.item_type === 'offer' && (item.token_type === 0 || item.token_type === 1) // ETH or ERC20
      );
      
      if (!nftItem || !paymentItem) {
        return null;
      }
      
      const collection = nftItem.collections;
      const nft = nftItem.nfts?.[0] || nftItem.nfts;
      
      // Convert wei to ETH (assuming payment is in wei)
      const priceWei = BigInt(paymentItem.amount || '0');
      const priceEth = Number(priceWei) / 1e18;
      
      return {
        id: fulfillment.id,
        nft_image_url: nft?.image_url || null,
        collection_name: collection?.name || 'Unknown Collection',
        collection_address: collection?.contract_address || nftItem.token_address,
        token_id: nftItem.token_id,
        price: priceEth.toFixed(6),
        buyer_address: order.offerer_address, // In a listing, offerer is buyer
        seller_address: fulfillment.fulfiller_address || order.offerer_address, // Fulfiller is seller
        transaction_hash: fulfillment.transaction_hash,
        created_at: fulfillment.created_at,
      };
    }).filter(Boolean) || [];
    
    return NextResponse.json({ trades });
  } catch (error) {
    console.error('Error in recent trades GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

