/**
 * Unified Price Check API
 * Aggregates prices from LSSVM pools and Seaport listings/offers
 * Returns best available price with smart routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '~/lib/redis';
import {
  isLSSVMAvailable,
  getBestBuyPool,
  getBestSellPool,
  calculateBuyPrice,
  calculateSellPrice,
  formatWeiToEth,
} from '~/lib/lssvm';
import { createSupabaseClient } from '~/lib/supabase';
import type { BestPriceResult, TradeRoute } from '~/lib/lssvm/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nft = searchParams.get('nft')?.toLowerCase();
    const tokenId = searchParams.get('tokenId');
    const action = searchParams.get('action'); // 'buy' or 'sell'

    // Validate inputs
    if (!nft || !/^0x[a-fA-F0-9]{40}$/.test(nft)) {
      return NextResponse.json(
        { success: false, error: 'Invalid NFT contract address' },
        { status: 400 }
      );
    }

    if (!action || !['buy', 'sell'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    // Check cache (L1 - 5 min for price data)
    const cacheKey = `such-market:trading:price:${nft}:${tokenId || 'floor'}:${action}`;
    const cached = await getCache<BestPriceResult>(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // Fetch prices from both sources in parallel
    const [lssvmPrice, seaportPrice] = await Promise.all([
      fetchLSSVMPrice(nft, tokenId, action),
      fetchSeaportPrice(nft, tokenId, action),
    ]);

    // Determine best route
    const result = determineBestRoute(lssvmPrice, seaportPrice, action);

    // Cache result (L1 - hot data, 5 min)
    await setCache(cacheKey, result, 300);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Price check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch price data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch price from LSSVM pools
 */
async function fetchLSSVMPrice(
  nft: string,
  tokenId: string | null,
  action: string
): Promise<TradeRoute | null> {
  // Skip if LSSVM not available
  if (!isLSSVMAvailable()) {
    console.log('LSSVM not available, skipping pool price check');
    return null;
  }

  try {
    if (action === 'buy') {
      const pool = await getBestBuyPool(nft);
      if (!pool) return null;

      const quote = calculateBuyPrice(pool, 1);
      if (!quote.available) return null;

      return {
        source: 'lssvm',
        route: 'pool',
        price: quote.price,
        priceEth: formatWeiToEth(quote.price),
        instant: true,
        poolId: pool.id,
        metadata: {
          poolType: pool.type,
          spotPrice: pool.spotPrice,
          fee: quote.fee,
        },
      };
    } else {
      // Selling to pool
      const pool = await getBestSellPool(nft);
      if (!pool) return null;

      const quote = calculateSellPrice(pool, 1);
      if (!quote.available) return null;

      return {
        source: 'lssvm',
        route: 'pool',
        price: quote.price,
        priceEth: formatWeiToEth(quote.price),
        instant: true,
        poolId: pool.id,
        metadata: {
          poolType: pool.type,
          spotPrice: pool.spotPrice,
          fee: quote.fee,
        },
      };
    }
  } catch (error) {
    console.error('Error fetching LSSVM price:', error);
    return null;
  }
}

/**
 * Fetch price from Seaport listings/offers
 */
async function fetchSeaportPrice(
  nft: string,
  tokenId: string | null,
  action: string
): Promise<TradeRoute | null> {
  try {
    const supabase = createSupabaseClient();

    if (action === 'buy') {
      // Find best listing (lowest price)
      let query = supabase
        .from('seaport_orders')
        .select(`
          order_hash,
          price,
          expiration,
          offerer,
          seaport_order_items (
            token_address,
            token_id
          )
        `)
        .eq('order_type', 'LISTING')
        .eq('status', 'ACTIVE')
        .gt('expiration', new Date().toISOString())
        .order('price', { ascending: true })
        .limit(10);

      const { data: listings } = await query;

      if (!listings || listings.length === 0) return null;

      // Filter by specific token ID if provided
      const matchingListing = tokenId
        ? listings.find(l =>
            l.seaport_order_items?.some(
              (item: any) =>
                item.token_address.toLowerCase() === nft &&
                item.token_id === tokenId
            )
          )
        : listings[0];

      if (!matchingListing) return null;

      return {
        source: 'seaport',
        route: 'listing',
        price: matchingListing.price,
        priceEth: formatWeiToEth(matchingListing.price),
        instant: false, // Requires signature
        orderHash: matchingListing.order_hash,
        expiration: new Date(matchingListing.expiration).getTime() / 1000,
        metadata: {
          seller: matchingListing.offerer,
        },
      };
    } else {
      // Find best offer (highest price)
      let query = supabase
        .from('seaport_orders')
        .select(`
          order_hash,
          price,
          expiration,
          offerer,
          seaport_order_items (
            token_address,
            token_id
          )
        `)
        .eq('order_type', 'OFFER')
        .eq('status', 'ACTIVE')
        .gt('expiration', new Date().toISOString())
        .order('price', { ascending: false })
        .limit(10);

      const { data: offers } = await query;

      if (!offers || offers.length === 0) return null;

      // Filter by specific token ID if provided
      const matchingOffer = tokenId
        ? offers.find(o =>
            o.seaport_order_items?.some(
              (item: any) =>
                item.token_address.toLowerCase() === nft &&
                item.token_id === tokenId
            )
          )
        : offers[0];

      if (!matchingOffer) return null;

      return {
        source: 'seaport',
        route: 'offer',
        price: matchingOffer.price,
        priceEth: formatWeiToEth(matchingOffer.price),
        instant: false, // Requires signature
        orderHash: matchingOffer.order_hash,
        expiration: new Date(matchingOffer.expiration).getTime() / 1000,
        metadata: {
          buyer: matchingOffer.offerer,
        },
      };
    }
  } catch (error) {
    console.error('Error fetching Seaport price:', error);
    return null;
  }
}

/**
 * Determine best route based on price and availability
 */
function determineBestRoute(
  lssvmPrice: TradeRoute | null,
  seaportPrice: TradeRoute | null,
  action: string
): BestPriceResult {
  const alternatives: TradeRoute[] = [];

  // If both are available, compare prices
  if (lssvmPrice && seaportPrice) {
    const lssvmWei = BigInt(lssvmPrice.price);
    const seaportWei = BigInt(seaportPrice.price);

    let bestPrice: TradeRoute;

    if (action === 'buy') {
      // When buying, prefer lower price
      if (lssvmWei < seaportWei) {
        bestPrice = lssvmPrice;
        alternatives.push(seaportPrice);
      } else {
        bestPrice = seaportPrice;
        alternatives.push(lssvmPrice);
      }
    } else {
      // When selling, prefer higher price
      if (lssvmWei > seaportWei) {
        bestPrice = lssvmPrice;
        alternatives.push(seaportPrice);
      } else {
        bestPrice = seaportPrice;
        alternatives.push(lssvmPrice);
      }
    }

    return {
      bestPrice,
      alternatives,
      cached: false,
    };
  }

  // Only one source available
  if (lssvmPrice) {
    return {
      bestPrice: lssvmPrice,
      alternatives: [],
      cached: false,
    };
  }

  if (seaportPrice) {
    return {
      bestPrice: seaportPrice,
      alternatives: [],
      cached: false,
    };
  }

  // No prices available - create a "not available" result
  const notAvailableRoute: TradeRoute = {
    source: 'lssvm',
    route: 'pool',
    price: '0',
    priceEth: '0',
    instant: false,
    metadata: {
      error: 'No liquidity available',
    },
  };

  return {
    bestPrice: notAvailableRoute,
    alternatives: [],
    cached: false,
  };
}
