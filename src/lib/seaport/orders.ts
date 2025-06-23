import { SEAPORT_CONFIG, ITEM_TYPES, ORDER_TYPES } from './config';
import { generateSalt, getCurrentTimestamp } from '../db/seaport';
import type { OfferItem, ConsiderationItem } from '../db/seaport';

// Types for order creation
export interface CreateListingParams {
  offererAddress: string;
  tokenAddress: string;
  tokenId: string;
  price: string;
  currency?: string; // Defaults to ETH
  duration?: number; // Defaults to 7 days
  fcUserId?: number;
  frameUrl?: string;
}

export interface CreateOfferParams {
  offererAddress: string;
  tokenAddress: string;
  tokenId: string;
  offerAmount: string;
  currency?: string; // Defaults to ETH
  duration?: number; // Defaults to 7 days
  fcUserId?: number;
  frameUrl?: string;
}

export interface OrderComponents {
  offerer: string;
  zone: string;
  offer: OfferItem[];
  consideration: ConsiderationItem[];
  orderType: number;
  startTime: number;
  endTime: number;
  zoneHash: string;
  salt: string;
  conduitKey: string;
  counter: number;
}

// Create a listing order (NFT for ETH/ERC20)
export function createListingOrder(params: CreateListingParams): {
  orderComponents: OrderComponents;
  orderHash: string;
} {
  const {
    offererAddress,
    tokenAddress,
    tokenId,
    price,
    currency = SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH,
    duration = SEAPORT_CONFIG.DEFAULT_LISTING_DURATION
  } = params;

  const startTime = getCurrentTimestamp();
  const endTime = startTime + duration;
  const salt = generateSalt();

  // Offer: NFT
  const offer: OfferItem[] = [{
    itemType: ITEM_TYPES.ERC721,
    token: tokenAddress.toLowerCase(),
    identifierOrCriteria: tokenId,
    startAmount: '1',
    endAmount: '1'
  }];

  // Consideration: ETH/ERC20
  const consideration: ConsiderationItem[] = [{
    itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
    token: currency,
    identifierOrCriteria: '0',
    startAmount: price,
    endAmount: price,
    recipient: offererAddress.toLowerCase()
  }];

  const orderComponents: OrderComponents = {
    offerer: offererAddress.toLowerCase(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer,
    consideration,
    orderType: ORDER_TYPES.FULL_OPEN,
    startTime,
    endTime,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt,
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: 0 // TODO: Get actual counter from Seaport contract
  };

  // Generate order hash (simplified - in real implementation, this would use Seaport's getOrderHash)
  const orderHash = generateOrderHash(orderComponents);

  return { orderComponents, orderHash };
}

// Create an offer order (ETH/ERC20 for NFT)
export function createOfferOrder(params: CreateOfferParams): {
  orderComponents: OrderComponents;
  orderHash: string;
} {
  const {
    offererAddress,
    tokenAddress,
    tokenId,
    offerAmount,
    currency = SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH,
    duration = SEAPORT_CONFIG.DEFAULT_OFFER_DURATION
  } = params;

  const startTime = getCurrentTimestamp();
  const endTime = startTime + duration;
  const salt = generateSalt();

  // Offer: ETH/ERC20
  const offer: OfferItem[] = [{
    itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
    token: currency,
    identifierOrCriteria: '0',
    startAmount: offerAmount,
    endAmount: offerAmount
  }];

  // Consideration: NFT
  const consideration: ConsiderationItem[] = [{
    itemType: ITEM_TYPES.ERC721,
    token: tokenAddress.toLowerCase(),
    identifierOrCriteria: tokenId,
    startAmount: '1',
    endAmount: '1',
    recipient: offererAddress.toLowerCase()
  }];

  const orderComponents: OrderComponents = {
    offerer: offererAddress.toLowerCase(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer,
    consideration,
    orderType: ORDER_TYPES.FULL_OPEN,
    startTime,
    endTime,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt,
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: 0 // TODO: Get actual counter from Seaport contract
  };

  // Generate order hash (simplified - in real implementation, this would use Seaport's getOrderHash)
  const orderHash = generateOrderHash(orderComponents);

  return { orderComponents, orderHash };
}

// Create a listing with royalties
export function createListingWithRoyalties(params: CreateListingParams & {
  creatorAddress: string;
  royaltyBps: number; // Basis points (e.g., 250 = 2.5%)
}): {
  orderComponents: OrderComponents;
  orderHash: string;
} {
  const {
    offererAddress,
    tokenAddress,
    tokenId,
    price,
    currency = SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH,
    duration = SEAPORT_CONFIG.DEFAULT_LISTING_DURATION,
    creatorAddress,
    royaltyBps
  } = params;

  const startTime = getCurrentTimestamp();
  const endTime = startTime + duration;
  const salt = generateSalt();

  // Calculate amounts
  const priceBN = BigInt(price);
  const royaltyAmount = (priceBN * BigInt(royaltyBps)) / BigInt(10000);
  const sellerAmount = priceBN - royaltyAmount;

  // Offer: NFT
  const offer: OfferItem[] = [{
    itemType: ITEM_TYPES.ERC721,
    token: tokenAddress.toLowerCase(),
    identifierOrCriteria: tokenId,
    startAmount: '1',
    endAmount: '1'
  }];

  // Consideration: Multiple recipients
  const consideration: ConsiderationItem[] = [
    // Seller receives most of the ETH
    {
      itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
      token: currency,
      identifierOrCriteria: '0',
      startAmount: sellerAmount.toString(),
      endAmount: sellerAmount.toString(),
      recipient: offererAddress.toLowerCase()
    },
    // Creator receives royalties
    {
      itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
      token: currency,
      identifierOrCriteria: '0',
      startAmount: royaltyAmount.toString(),
      endAmount: royaltyAmount.toString(),
      recipient: creatorAddress.toLowerCase()
    }
  ];

  const orderComponents: OrderComponents = {
    offerer: offererAddress.toLowerCase(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer,
    consideration,
    orderType: ORDER_TYPES.FULL_OPEN,
    startTime,
    endTime,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt,
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: 0 // TODO: Get actual counter from Seaport contract
  };

  const orderHash = generateOrderHash(orderComponents);

  return { orderComponents, orderHash };
}

// Create an offer with platform fee
export function createOfferWithPlatformFee(params: CreateOfferParams & {
  platformFeeBps: number; // Basis points
}): {
  orderComponents: OrderComponents;
  orderHash: string;
} {
  const {
    offererAddress,
    tokenAddress,
    tokenId,
    offerAmount,
    currency = SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH,
    duration = SEAPORT_CONFIG.DEFAULT_OFFER_DURATION,
    platformFeeBps
  } = params;

  const startTime = getCurrentTimestamp();
  const endTime = startTime + duration;
  const salt = generateSalt();

  // Calculate amounts
  const offerAmountBN = BigInt(offerAmount);
  const platformFee = (offerAmountBN * BigInt(platformFeeBps)) / BigInt(10000);

  // Offer: ETH/ERC20
  const offer: OfferItem[] = [{
    itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
    token: currency,
    identifierOrCriteria: '0',
    startAmount: offerAmount,
    endAmount: offerAmount
  }];

  // Consideration: Multiple recipients
  const consideration: ConsiderationItem[] = [
    // NFT owner receives net amount
    {
      itemType: ITEM_TYPES.ERC721,
      token: tokenAddress.toLowerCase(),
      identifierOrCriteria: tokenId,
      startAmount: '1',
      endAmount: '1',
      recipient: offererAddress.toLowerCase()
    },
    // Platform receives fee
    {
      itemType: currency === SEAPORT_CONFIG.SUPPORTED_CURRENCIES.ETH ? ITEM_TYPES.NATIVE : ITEM_TYPES.ERC20,
      token: currency,
      identifierOrCriteria: '0',
      startAmount: platformFee.toString(),
      endAmount: platformFee.toString(),
      recipient: SEAPORT_CONFIG.PLATFORM_FEE_RECIPIENT
    }
  ];

  const orderComponents: OrderComponents = {
    offerer: offererAddress.toLowerCase(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer,
    consideration,
    orderType: ORDER_TYPES.FULL_OPEN,
    startTime,
    endTime,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    salt,
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: 0 // TODO: Get actual counter from Seaport contract
  };

  const orderHash = generateOrderHash(orderComponents);

  return { orderComponents, orderHash };
}

// Generate order hash (simplified implementation)
// In production, this should use Seaport's actual getOrderHash function
function generateOrderHash(orderComponents: OrderComponents): string {
  const orderData = JSON.stringify(orderComponents);
  const hash = '0x' + Array.from(
    new TextEncoder().encode(orderData)
  ).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Truncate to 64 characters (32 bytes)
  return hash.slice(0, 66); // 0x + 64 hex chars
}

// Validate order components
export function validateOrderComponents(orderComponents: OrderComponents): boolean {
  // Basic validation
  if (!orderComponents.offerer || !orderComponents.offer || !orderComponents.consideration) {
    return false;
  }

  if (orderComponents.startTime >= orderComponents.endTime) {
    return false;
  }

  if (orderComponents.offer.length === 0 || orderComponents.consideration.length === 0) {
    return false;
  }

  return true;
}

// Get order counter from Seaport contract (placeholder)
export async function getOrderCounter(offererAddress: string): Promise<number> {
  // TODO: Implement actual Seaport contract call
  console.log('TODO: Get order counter for:', offererAddress);
  return 0;
} 