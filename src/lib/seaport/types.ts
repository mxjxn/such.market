/**
 * TypeScript types for Seaport integration
 */

import type { OrderComponents } from '@opensea/seaport-js/lib/types';

/**
 * Request to create an offer
 */
export interface CreateOfferRequest {
  contractAddress: string;
  tokenId: string;
  offerAmountEth: string;
  offererAddress: string;
  durationDays?: number;
}

/**
 * Response from offer creation
 */
export interface CreateOfferResponse {
  success: boolean;
  orderComponents: OrderComponents;
  orderHash: string;
  message?: string;
  error?: string;
}

/**
 * Request to fulfill an offer
 */
export interface FulfillOfferRequest {
  orderComponents: OrderComponents;
  signature: string;
  fulfillerAddress: string;
}

/**
 * Response from offer fulfillment
 */
export interface FulfillOfferResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

