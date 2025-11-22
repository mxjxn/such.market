/**
 * LSSVM Integration
 * Liquidity pool integration for Such.Market
 *
 * This module provides utilities for:
 * - Querying LSSVM liquidity pools via subgraph
 * - Calculating buy/sell prices for different curve types
 * - Comparing pool prices with Seaport listings
 * - Smart routing for best execution
 */

// Client and utilities
export {
  lssvmClient,
  queryLSSVM,
  isLSSVMAvailable,
  createLSSVMError,
  validatePoolData,
  formatWeiToEth,
  formatEthToWei,
  healthCheck,
} from './client';

// Queries
export {
  getCollectionPools,
  getBestBuyPool,
  getBestSellPool,
  getPoolById,
  getCollectionLiquidity,
  hasLiquidity,
  getPoolsByTradeType,
} from './queries';

// Pricing
export {
  calculateBuyPrice,
  calculateSellPrice,
  formatPriceQuote,
  comparePriceQuotes,
  calculatePriceImpact,
  estimateSlippage,
  getBestQuoteFromPools,
} from './pricing';

// Types
export type {
  PoolData,
  PoolPriceQuote,
  CollectionLiquidity,
  TradeRoute,
  BestPriceResult,
  LSSVMError,
} from './types';

export { PoolType, PoolTradeType } from './types';
