/**
 * Seaport Order Creation Utilities
 * 
 * Functions for creating and managing Seaport orders (offers and listings)
 */

import { Seaport } from '@opensea/seaport-js';
import { JsonRpcProvider } from 'ethers';
import type { OrderComponents, CreateOrderInput } from '@opensea/seaport-js/lib/types';
import { SEAPORT_CONFIG } from './config';
import { parseEther, formatEther } from 'ethers';

/**
 * Initialize Seaport instance with Base mainnet provider
 */
export function getSeaportInstance(rpcUrl?: string): Seaport {
  const provider = new JsonRpcProvider(rpcUrl || SEAPORT_CONFIG.RPC_URL);
  return new Seaport(provider, {
    overrides: {
      contractAddress: SEAPORT_CONFIG.SEAPORT_V1_6,
    },
    conduitKeyToConduit: {
      [SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY]: '0x1E0049783F008A0085193E00003D3cdF8dFCb9c1', // OpenSea conduit
    },
  });
}

/**
 * Generate a random salt for order uniqueness
 */
export function generateSalt(): string {
  const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
  return '0x' + randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ETH amount to wei (BigNumber string)
 */
export function ethToWei(ethAmount: string): string {
  try {
    return parseEther(ethAmount).toString();
  } catch (error) {
    throw new Error(`Invalid ETH amount: ${ethAmount}`);
  }
}

/**
 * Convert wei to ETH amount
 */
export function weiToEth(weiAmount: string): string {
  try {
    return formatEther(weiAmount);
  } catch (error) {
    throw new Error(`Invalid wei amount: ${weiAmount}`);
  }
}

/**
 * Create an offer order (ETH for NFT)
 * 
 * @param offererAddress - Address making the offer
 * @param nftContractAddress - Address of the NFT contract
 * @param tokenId - Token ID of the NFT
 * @param offerAmountEth - Offer amount in ETH (e.g., "0.001")
 * @param durationDays - Order duration in days (default: 7)
 * @returns Order components ready for signing
 */
export async function createOfferOrder(
  offererAddress: string,
  nftContractAddress: string,
  tokenId: string,
  offerAmountEth: string,
  durationDays: number = SEAPORT_CONFIG.DEFAULT_ORDER_DURATION_DAYS
): Promise<OrderComponents> {
  const seaport = getSeaportInstance();
  
  // Convert ETH to wei
  const offerAmountWei = ethToWei(offerAmountEth);
  
  // Get current counter for the offerer
  const counter = await seaport.getCounter(offererAddress);
  
  // Calculate timestamps
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + (durationDays * 24 * 60 * 60);
  
  // Create order input
  const orderInput: CreateOrderInput = {
    offer: [
      {
        itemType: 0, // NATIVE (ETH)
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: offerAmountWei,
        endAmount: offerAmountWei,
      },
    ],
    consideration: [
      {
        itemType: 2, // ERC721
        token: nftContractAddress,
        identifierOrCriteria: tokenId,
        startAmount: '1',
        endAmount: '1',
        recipient: offererAddress,
      },
    ],
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: counter.toString(),
    allowPartialFills: false,
    restrictedByZone: false,
  };
  
  // Create the order use case
  const orderUseCase = await seaport.createOrder(orderInput, offererAddress);
  
  // Get the order components from the use case
  // The use case contains actions, we need to extract the order components
  // For now, we'll construct them manually based on the input
  const orderComponents: OrderComponents = {
    offerer: offererAddress,
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer: orderInput.offer.map(item => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: item.identifierOrCriteria,
      startAmount: item.startAmount,
      endAmount: item.endAmount,
    })),
    consideration: orderInput.consideration.map(item => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: item.identifierOrCriteria,
      startAmount: item.startAmount,
      endAmount: item.endAmount,
      recipient: item.recipient,
    })),
    orderType: 0, // FULL_OPEN
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    zoneHash: orderInput.zoneHash,
    salt: generateSalt(),
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: counter.toString(),
    totalOriginalConsiderationItems: orderInput.consideration.length.toString(),
  };
  
  return orderComponents;
}

/**
 * Create a listing order (NFT for ETH)
 * 
 * @param sellerAddress - Address selling the NFT
 * @param nftContractAddress - Address of the NFT contract
 * @param tokenId - Token ID of the NFT
 * @param priceEth - Listing price in ETH (e.g., "0.1")
 * @param durationDays - Order duration in days (default: 7)
 * @returns Order components ready for signing
 */
export async function createListingOrder(
  sellerAddress: string,
  nftContractAddress: string,
  tokenId: string,
  priceEth: string,
  durationDays: number = SEAPORT_CONFIG.DEFAULT_ORDER_DURATION_DAYS
): Promise<OrderComponents> {
  const seaport = getSeaportInstance();
  
  // Convert ETH to wei
  const priceWei = ethToWei(priceEth);
  
  // Get current counter for the seller
  const counter = await seaport.getCounter(sellerAddress);
  
  // Calculate timestamps
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + (durationDays * 24 * 60 * 60);
  
  // Create order input
  const orderInput: CreateOrderInput = {
    offer: [
      {
        itemType: 2, // ERC721
        token: nftContractAddress,
        identifierOrCriteria: tokenId,
        startAmount: '1',
        endAmount: '1',
      },
    ],
    consideration: [
      {
        itemType: 0, // NATIVE (ETH)
        token: '0x0000000000000000000000000000000000000000',
        identifierOrCriteria: '0',
        startAmount: priceWei,
        endAmount: priceWei,
        recipient: sellerAddress,
      },
    ],
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: counter.toString(),
    allowPartialFills: false,
    restrictedByZone: false,
  };
  
  // Construct order components
  const orderComponents: OrderComponents = {
    offerer: sellerAddress,
    zone: SEAPORT_CONFIG.DEFAULT_ZONE,
    offer: orderInput.offer.map(item => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: item.identifierOrCriteria,
      startAmount: item.startAmount,
      endAmount: item.endAmount,
    })),
    consideration: orderInput.consideration.map(item => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: item.identifierOrCriteria,
      startAmount: item.startAmount,
      endAmount: item.endAmount,
      recipient: item.recipient,
    })),
    orderType: 0, // FULL_OPEN
    startTime: startTime.toString(),
    endTime: endTime.toString(),
    zoneHash: orderInput.zoneHash,
    salt: generateSalt(),
    conduitKey: SEAPORT_CONFIG.DEFAULT_CONDUIT_KEY,
    counter: counter.toString(),
    totalOriginalConsiderationItems: orderInput.consideration.length.toString(),
  };
  
  return orderComponents;
}

/**
 * Get order hash from order components
 */
export function getOrderHash(orderComponents: OrderComponents): string {
  const seaport = getSeaportInstance();
  return seaport.getOrderHash(orderComponents);
}

/**
 * Get counter for an address
 */
export async function getCounter(address: string): Promise<bigint> {
  const seaport = getSeaportInstance();
  return await seaport.getCounter(address);
}

