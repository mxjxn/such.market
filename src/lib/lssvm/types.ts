/**
 * LSSVM Pool Types
 * Type definitions for LSSVM liquidity pools and pricing
 */

export enum PoolType {
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  XYK = 'XYK',
}

export enum PoolTradeType {
  BUY = 'BUY',     // Pool buys NFTs (users sell to pool)
  SELL = 'SELL',   // Pool sells NFTs (users buy from pool)
  TRADE = 'TRADE', // Pool does both
}

export interface PoolData {
  id: string;
  collection: {
    id: string;
    name: string;
    symbol?: string;
  };
  type: PoolType;
  tradeType: PoolTradeType;
  spotPrice: string;        // In wei
  delta: string;            // Depends on curve type
  fee: string;              // In basis points (e.g., 100 = 1%)
  nftBalance: number;       // Number of NFTs in pool
  tokenBalance: string;     // ETH/token balance in wei
  active: boolean;
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface PoolPriceQuote {
  poolId: string;
  type: PoolType;
  price: string;            // Total price in wei
  pricePerNFT: string;      // Average price per NFT in wei
  numNFTs: number;
  fee: string;              // Fee amount in wei
  spotPrice: string;        // Current spot price in wei
  newSpotPrice: string;     // Spot price after trade
  available: boolean;       // Can trade be executed?
  reason?: string;          // If not available, why?
}

export interface CollectionLiquidity {
  collection: string;
  totalPools: number;
  totalNFTBalance: number;
  totalTokenBalance: string; // In wei
  bestBuyPrice: string | null;  // Best price to buy from pool (in wei)
  bestSellPrice: string | null; // Best price to sell to pool (in wei)
  pools: PoolData[];
}

export interface TradeRoute {
  source: 'lssvm' | 'seaport';
  route: 'pool' | 'listing' | 'offer';
  price: string;              // In wei
  priceEth: string;           // Human-readable ETH
  instant: boolean;           // Can execute immediately?
  poolId?: string;            // If LSSVM pool
  orderHash?: string;         // If Seaport order
  expiration?: number;        // Unix timestamp
  metadata?: Record<string, any>;
}

export interface BestPriceResult {
  bestPrice: TradeRoute;
  alternatives: TradeRoute[];
  poolLiquidity?: CollectionLiquidity;
  cached: boolean;
  cacheAge?: number;          // Seconds since cached
}

export interface LSSVMError {
  code: 'INSUFFICIENT_LIQUIDITY' | 'INVALID_POOL' | 'PRICE_SLIPPAGE' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  details?: any;
}
