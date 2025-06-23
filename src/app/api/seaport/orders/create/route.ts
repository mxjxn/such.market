import { NextRequest, NextResponse } from 'next/server';
import { createListingOrder, createOfferOrder, validateOrderComponents } from '../../../../../lib/seaport/orders';
import { storeOrder } from '../../../../../lib/db/seaport';
import { SEAPORT_CONFIG } from '../../../../../lib/seaport/config';

// GET handler for order creation form (if needed)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderType = searchParams.get('type'); // 'listing' or 'offer'
    
    return NextResponse.json({
      success: true,
      message: 'Order creation endpoint',
      supportedOrderTypes: ['listing', 'offer'],
      currentType: orderType,
      supportedCurrencies: Object.keys(SEAPORT_CONFIG.SUPPORTED_CURRENCIES)
    });
  } catch (error) {
    console.error('Error in GET /api/seaport/orders/create:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST handler for creating orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderType, // 'listing' or 'offer'
      offererAddress,
      tokenAddress,
      tokenId,
      price, // for listings
      offerAmount, // for offers
      currency = SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH,
      duration,
      fcUserId,
      frameUrl
    } = body;

    // Validate required fields
    if (!orderType || !offererAddress || !tokenAddress || !tokenId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate order type
    if (!['listing', 'offer'].includes(orderType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order type. Must be "listing" or "offer"' },
        { status: 400 }
      );
    }

    // Validate price/amount
    if (orderType === 'listing' && !price) {
      return NextResponse.json(
        { success: false, error: 'Price is required for listings' },
        { status: 400 }
      );
    }

    if (orderType === 'offer' && !offerAmount) {
      return NextResponse.json(
        { success: false, error: 'Offer amount is required for offers' },
        { status: 400 }
      );
    }

    let orderComponents;
    let orderHash;

    // Create order based on type
    if (orderType === 'listing') {
      const result = createListingOrder({
        offererAddress,
        tokenAddress,
        tokenId,
        price,
        currency,
        duration,
        fcUserId,
        frameUrl
      });
      orderComponents = result.orderComponents;
      orderHash = result.orderHash;
    } else {
      const result = createOfferOrder({
        offererAddress,
        tokenAddress,
        tokenId,
        offerAmount: offerAmount,
        currency,
        duration,
        fcUserId,
        frameUrl
      });
      orderComponents = result.orderComponents;
      orderHash = result.orderHash;
    }

    // Validate order components
    if (!validateOrderComponents(orderComponents)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order components' },
        { status: 400 }
      );
    }

    // Store order in database
    const storedOrder = await storeOrder({
      orderHash,
      offererAddress,
      orderType,
      startTime: orderComponents.startTime,
      endTime: orderComponents.endTime,
      salt: orderComponents.salt,
      counter: orderComponents.counter,
      offerItems: orderComponents.offer,
      considerationItems: orderComponents.consideration,
      fcUserId,
      frameUrl,
      conduitKey: orderComponents.conduitKey,
      zoneHash: orderComponents.zoneHash
    });

    return NextResponse.json({
      success: true,
      message: `${orderType} created successfully`,
      data: {
        orderHash,
        orderId: storedOrder.id,
        orderComponents,
        frameUrl: frameUrl || `${process.env.NEXT_PUBLIC_APP_URL}/seaport/order/${orderHash}`
      }
    });

  } catch (error) {
    console.error('Error creating Seaport order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
} 