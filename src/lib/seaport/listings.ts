/**
 * Seaport Listings Utilities
 * Helper functions for querying and managing Seaport listings
 */

import { createSupabaseClient } from '~/lib/supabase';

export interface SeaportListing {
  orderHash: string;
  offerer: string;
  price: string;
  tokenAddress: string;
  tokenId: string;
  expiration: string;
  status: string;
  createdAt: string;
}

/**
 * Get active listings for a collection
 */
export async function getActiveListings(
  contractAddress: string
): Promise<SeaportListing[]> {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('seaport_orders')
      .select(`
        order_hash,
        offerer,
        price,
        expiration,
        status,
        created_at,
        seaport_order_items (
          token_address,
          token_id
        )
      `)
      .eq('order_type', 'LISTING')
      .eq('status', 'ACTIVE')
      .gt('expiration', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching listings:', error);
      return [];
    }

    // Filter and flatten results
    const listings: SeaportListing[] = [];

    for (const order of data) {
      if (!order.seaport_order_items || order.seaport_order_items.length === 0) continue;

      for (const item of order.seaport_order_items as any[]) {
        if (item.token_address.toLowerCase() === contractAddress.toLowerCase()) {
          listings.push({
            orderHash: order.order_hash,
            offerer: order.offerer,
            price: order.price,
            tokenAddress: item.token_address,
            tokenId: item.token_id,
            expiration: order.expiration,
            status: order.status,
            createdAt: order.created_at,
          });
        }
      }
    }

    return listings;
  } catch (error) {
    console.error('Error in getActiveListings:', error);
    return [];
  }
}

/**
 * Get listing for specific NFT
 */
export async function getListingForNFT(
  contractAddress: string,
  tokenId: string
): Promise<SeaportListing | null> {
  const listings = await getActiveListings(contractAddress);
  return listings.find(l => l.tokenId === tokenId) || null;
}

/**
 * Get floor price from active listings
 */
export async function getListingFloorPrice(
  contractAddress: string
): Promise<string | null> {
  const listings = await getActiveListings(contractAddress);
  if (listings.length === 0) return null;

  const prices = listings.map(l => BigInt(l.price));
  const minPrice = prices.reduce((min, price) => (price < min ? price : min));

  return minPrice.toString();
}

/**
 * Count active listings for collection
 */
export async function countActiveListings(contractAddress: string): Promise<number> {
  const listings = await getActiveListings(contractAddress);
  return listings.length;
}
