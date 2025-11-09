import { NextResponse } from 'next/server';
import { getSeaportInstance } from '~/lib/seaport/orders';
import type { FulfillOfferRequest, FulfillOfferResponse } from '~/lib/seaport/types';
import { SEAPORT_CONFIG } from '~/lib/seaport/config';

/**
 * POST /api/seaport/offers/fulfill
 * 
 * Fulfills a Seaport offer order (accepts an offer)
 * 
 * Request body:
 * {
 *   orderComponents: OrderComponents;
 *   signature: string;
 *   fulfillerAddress: string;
 * }
 * 
 * Note: This endpoint requires the fulfiller to have a signer/provider.
 * For now, this is a placeholder that returns the transaction data.
 * The actual fulfillment should be done client-side with the user's wallet.
 */
export async function POST(request: Request) {
  try {
    const body: FulfillOfferRequest = await request.json();
    
    // Validate required fields
    if (!body.orderComponents || !body.signature || !body.fulfillerAddress) {
      return NextResponse.json<FulfillOfferResponse>(
        {
          success: false,
          error: 'Missing required fields: orderComponents, signature, fulfillerAddress',
        },
        { status: 400 }
      );
    }
    
    // Validate fulfiller address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.fulfillerAddress)) {
      return NextResponse.json<FulfillOfferResponse>(
        {
          success: false,
          error: 'Invalid fulfiller address format',
        },
        { status: 400 }
      );
    }
    
    // Note: Fulfillment requires a signer, which we don't have on the server.
    // The actual fulfillment should be done client-side using the user's wallet.
    // This endpoint is provided for future use or for validation purposes.
    
    // For now, we'll return instructions for client-side fulfillment
    return NextResponse.json<FulfillOfferResponse>(
      {
        success: false,
        error: 'Fulfillment must be done client-side with the user\'s wallet. Use wagmi/viem to call the Seaport contract directly.',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error fulfilling offer:', error);
    
    return NextResponse.json<FulfillOfferResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fulfill offer',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seaport/offers/fulfill
 * 
 * Returns information about how to fulfill an offer client-side
 */
export async function GET() {
  return NextResponse.json({
    message: 'To fulfill an offer, call the Seaport contract\'s fulfillBasicOrder or fulfillAdvancedOrder method with the signed order.',
    seaportAddress: SEAPORT_CONFIG.SEAPORT_V1_6,
    chainId: SEAPORT_CONFIG.CHAIN_ID,
    documentation: 'See Seaport contract documentation for fulfillment methods',
  });
}

