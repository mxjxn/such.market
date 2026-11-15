import { Address } from 'viem'

// Pool Type enum
export enum PoolType {
  TOKEN = 0,
  NFT = 1,
  TRADE = 2,
}

// Curve Error Codes
export enum CurveError {
  OK = 0,
  INVALID_NUMITEMS = 1,
  SPOT_PRICE_OVERFLOW = 2,
  DELTA_OVERFLOW = 3,
  SPOT_PRICE_UNDERFLOW = 4,
  AUCTION_ENDED = 5,
}

// Types
export interface PairSwapSpecific {
  pair: Address
  nftIds: bigint[]
}

export interface BuyNFTQuote {
  error: CurveError
  newSpotPrice: bigint
  newDelta: bigint
  inputAmount: bigint
  protocolFee: bigint
  royaltyAmount: bigint
}

export interface SellNFTQuote {
  error: CurveError
  newSpotPrice: bigint
  newDelta: bigint
  outputAmount: bigint
  protocolFee: bigint
  royaltyAmount: bigint
}

export interface PoolData {
  address: Address
  poolType: PoolType
  spotPrice: bigint
  delta: bigint
  fee: bigint
  nft: Address
  token: Address
  bondingCurve: Address
}

