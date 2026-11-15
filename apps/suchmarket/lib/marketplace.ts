import { Address } from 'viem'
import { getChainConfig } from './chain-config'

/** Core marketplace ABI (from cryptoart-studio apps/mvp). */
export const MARKETPLACE_ABI = [
  {
    type: 'function',
    name: 'getListing',
    inputs: [{ name: 'listingId', type: 'uint40', internalType: 'uint40' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IMarketplaceCore.Listing',
        components: [
          { name: 'id', type: 'uint256', internalType: 'uint256' },
          { name: 'seller', type: 'address', internalType: 'address payable' },
          { name: 'finalized', type: 'bool', internalType: 'bool' },
          { name: 'totalSold', type: 'uint24', internalType: 'uint24' },
          { name: 'marketplaceBPS', type: 'uint16', internalType: 'uint16' },
          { name: 'referrerBPS', type: 'uint16', internalType: 'uint16' },
          {
            name: 'details',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.ListingDetails',
            components: [
              { name: 'initialAmount', type: 'uint256', internalType: 'uint256' },
              { name: 'type_', type: 'uint8', internalType: 'enum MarketplaceLib.ListingType' },
              { name: 'totalAvailable', type: 'uint24', internalType: 'uint24' },
              { name: 'totalPerSale', type: 'uint24', internalType: 'uint24' },
              { name: 'extensionInterval', type: 'uint16', internalType: 'uint16' },
              { name: 'minIncrementBPS', type: 'uint16', internalType: 'uint16' },
              { name: 'erc20', type: 'address', internalType: 'address' },
              { name: 'identityVerifier', type: 'address', internalType: 'address' },
              { name: 'startTime', type: 'uint48', internalType: 'uint48' },
              { name: 'endTime', type: 'uint48', internalType: 'uint48' },
            ],
          },
          {
            name: 'token',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.TokenDetails',
            components: [
              { name: 'id', type: 'uint256', internalType: 'uint256' },
              { name: 'address_', type: 'address', internalType: 'address' },
              { name: 'spec', type: 'uint8', internalType: 'enum TokenLib.Spec' },
              { name: 'lazy', type: 'bool', internalType: 'bool' },
            ],
          },
          {
            name: 'receivers',
            type: 'tuple[]',
            internalType: 'struct MarketplaceLib.ListingReceiver[]',
            components: [
              { name: 'receiver', type: 'address', internalType: 'address payable' },
              { name: 'receiverBPS', type: 'uint16', internalType: 'uint16' },
            ],
          },
          {
            name: 'fees',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.DeliveryFees',
            components: [
              { name: 'deliverBPS', type: 'uint16', internalType: 'uint16' },
              { name: 'deliverFixed', type: 'uint240', internalType: 'uint240' },
            ],
          },
          {
            name: 'bid',
            type: 'tuple',
            internalType: 'struct MarketplaceLib.Bid',
            components: [
              { name: 'amount', type: 'uint256', internalType: 'uint256' },
              { name: 'bidder', type: 'address', internalType: 'address payable' },
              { name: 'delivered', type: 'bool', internalType: 'bool' },
              { name: 'settled', type: 'bool', internalType: 'bool' },
              { name: 'refunded', type: 'bool', internalType: 'bool' },
              { name: 'timestamp', type: 'uint48', internalType: 'uint48' },
              { name: 'referrer', type: 'address', internalType: 'address payable' },
            ],
          },
          { name: 'offersAccepted', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getListingCurrentPrice',
    inputs: [{ name: 'listingId', type: 'uint40', internalType: 'uint40' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bid',
    inputs: [
      { name: 'listingId', type: 'uint40', internalType: 'uint40' },
      { name: 'increase', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'CreateListing',
    inputs: [
      { name: 'listingId', type: 'uint40', indexed: true, internalType: 'uint40' },
      { name: 'marketplaceBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'referrerBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'listingType', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'totalAvailable', type: 'uint24', indexed: false, internalType: 'uint24' },
      { name: 'totalPerSale', type: 'uint24', indexed: false, internalType: 'uint24' },
      { name: 'startTime', type: 'uint48', indexed: false, internalType: 'uint48' },
      { name: 'endTime', type: 'uint48', indexed: false, internalType: 'uint48' },
      { name: 'initialAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'extensionInterval', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'minIncrementBPS', type: 'uint16', indexed: false, internalType: 'uint16' },
      { name: 'erc20', type: 'address', indexed: false, internalType: 'address' },
      { name: 'identityVerifier', type: 'address', indexed: false, internalType: 'address' },
    ],
    anonymous: false,
  },
] as const

export const ListingType = {
  INDIVIDUAL_AUCTION: 0,
  FIXED_PRICE: 1,
  DYNAMIC_PRICE: 2,
  OFFERS_ONLY: 3,
} as const

export type ContractListing = {
  id: bigint
  seller: Address
  finalized: boolean
  totalSold: number
  marketplaceBPS: number
  referrerBPS: number
  details: {
    initialAmount: bigint
    type_: number
    totalAvailable: number
    totalPerSale: number
    extensionInterval: number
    minIncrementBPS: number
    erc20: Address
    identityVerifier: Address
    startTime: bigint
    endTime: bigint
  }
  token: {
    id: bigint
    address_: Address
    spec: number
    lazy: boolean
  }
  bid: {
    amount: bigint
    bidder: Address
    delivered: boolean
    settled: boolean
    refunded: boolean
    timestamp: bigint
    referrer: Address
  }
  offersAccepted: boolean
}

export function getMarketplaceAddress(chainId: number): Address {
  const addr = getChainConfig(chainId)?.marketplaceAddress
  if (!addr) {
    throw new Error(
      `Marketplace not configured for chain ${chainId}. Set NEXT_PUBLIC_MARKETPLACE_ADDRESS_${chainId} in Vercel.`
    )
  }
  return addr
}

export function isAuctionListing(listing: ContractListing): boolean {
  return listing.details.type_ === ListingType.INDIVIDUAL_AUCTION
}

export function isActiveAuction(listing: ContractListing, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!isAuctionListing(listing) || listing.finalized) return false
  const start = Number(listing.details.startTime)
  const end = Number(listing.details.endTime)
  if (start > 0 && nowSec < start) return true
  if (end > 0 && nowSec >= end) return false
  return true
}