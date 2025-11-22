/**
 * LSSVM Pool Pricing Calculations
 * Calculate buy/sell prices for LINEAR, EXPONENTIAL, and XYK pool curves
 */

import type { PoolData, PoolPriceQuote, PoolType } from './types';
import { formatWeiToEth, createLSSVMError } from './client';

/**
 * Calculate buy price for N NFTs from a pool
 * (User buying NFTs from pool)
 */
export function calculateBuyPrice(
  pool: PoolData,
  numNFTs: number = 1
): PoolPriceQuote {
  // Validate inputs
  if (numNFTs <= 0) {
    throw createLSSVMError('INVALID_POOL', 'Number of NFTs must be positive');
  }

  if (pool.nftBalance < numNFTs) {
    return {
      poolId: pool.id,
      type: pool.type,
      price: '0',
      pricePerNFT: '0',
      numNFTs,
      fee: '0',
      spotPrice: pool.spotPrice,
      newSpotPrice: pool.spotPrice,
      available: false,
      reason: `Insufficient liquidity: pool has ${pool.nftBalance} NFTs, requested ${numNFTs}`,
    };
  }

  const spotPrice = BigInt(pool.spotPrice);
  const delta = BigInt(pool.delta);
  const fee = BigInt(pool.fee);

  let totalPrice = 0n;
  let currentSpotPrice = spotPrice;

  for (let i = 0; i < numNFTs; i++) {
    let price: bigint;

    switch (pool.type) {
      case 'LINEAR':
        price = currentSpotPrice;
        currentSpotPrice = currentSpotPrice + delta;
        break;

      case 'EXPONENTIAL':
        price = currentSpotPrice;
        // New price = current * (10000 + delta) / 10000
        // delta is in basis points (e.g., 100 = 1%)
        currentSpotPrice = (currentSpotPrice * (10000n + delta)) / 10000n;
        break;

      case 'XYK':
        // Constant product: k = x * y
        // When buying NFTs: new_nft_balance = old - 1
        // new_token_balance = k / new_nft_balance
        // price = new_token_balance - old_token_balance
        const k = BigInt(pool.nftBalance - i) * BigInt(pool.tokenBalance);
        const newNFTBalance = BigInt(pool.nftBalance - i - 1);

        if (newNFTBalance === 0n) {
          return {
            poolId: pool.id,
            type: pool.type,
            price: '0',
            pricePerNFT: '0',
            numNFTs,
            fee: '0',
            spotPrice: pool.spotPrice,
            newSpotPrice: pool.spotPrice,
            available: false,
            reason: 'Cannot empty pool (XYK requires at least 1 NFT)',
          };
        }

        const newTokenBalance = k / newNFTBalance;
        price = newTokenBalance - BigInt(pool.tokenBalance);
        currentSpotPrice = price; // For XYK, spot price changes with each trade
        break;

      default:
        throw createLSSVMError('INVALID_POOL', `Unknown pool type: ${pool.type}`);
    }

    totalPrice += price;
  }

  // Calculate fee (protocol + pool owner fee)
  const feeAmount = (totalPrice * fee) / 10000n;
  const totalWithFee = totalPrice + feeAmount;

  return {
    poolId: pool.id,
    type: pool.type,
    price: totalWithFee.toString(),
    pricePerNFT: (totalWithFee / BigInt(numNFTs)).toString(),
    numNFTs,
    fee: feeAmount.toString(),
    spotPrice: pool.spotPrice,
    newSpotPrice: currentSpotPrice.toString(),
    available: true,
  };
}

/**
 * Calculate sell price for N NFTs to a pool
 * (User selling NFTs to pool)
 */
export function calculateSellPrice(
  pool: PoolData,
  numNFTs: number = 1
): PoolPriceQuote {
  // Validate inputs
  if (numNFTs <= 0) {
    throw createLSSVMError('INVALID_POOL', 'Number of NFTs must be positive');
  }

  // Check if pool has enough tokens to buy NFTs
  const estimatedCost = BigInt(pool.spotPrice) * BigInt(numNFTs);
  if (BigInt(pool.tokenBalance) < estimatedCost) {
    return {
      poolId: pool.id,
      type: pool.type,
      price: '0',
      pricePerNFT: '0',
      numNFTs,
      fee: '0',
      spotPrice: pool.spotPrice,
      newSpotPrice: pool.spotPrice,
      available: false,
      reason: `Insufficient liquidity: pool balance too low`,
    };
  }

  const spotPrice = BigInt(pool.spotPrice);
  const delta = BigInt(pool.delta);
  const fee = BigInt(pool.fee);

  let totalPrice = 0n;
  let currentSpotPrice = spotPrice;

  for (let i = 0; i < numNFTs; i++) {
    let price: bigint;

    switch (pool.type) {
      case 'LINEAR':
        // When selling to pool, price decreases
        price = currentSpotPrice > delta ? currentSpotPrice - delta : 0n;
        currentSpotPrice = price > delta ? price - delta : 0n;
        break;

      case 'EXPONENTIAL':
        // New price = current * 10000 / (10000 + delta)
        price = currentSpotPrice;
        currentSpotPrice = (currentSpotPrice * 10000n) / (10000n + delta);
        break;

      case 'XYK':
        // Constant product: k = x * y
        // When selling NFTs: new_nft_balance = old + 1
        // new_token_balance = k / new_nft_balance
        // price = old_token_balance - new_token_balance
        const k = BigInt(pool.nftBalance + i) * BigInt(pool.tokenBalance);
        const newNFTBalance = BigInt(pool.nftBalance + i + 1);
        const newTokenBalance = k / newNFTBalance;
        price = BigInt(pool.tokenBalance) - newTokenBalance;
        currentSpotPrice = price;
        break;

      default:
        throw createLSSVMError('INVALID_POOL', `Unknown pool type: ${pool.type}`);
    }

    totalPrice += price;
  }

  // Subtract fee (pool takes fee from seller)
  const feeAmount = (totalPrice * fee) / 10000n;
  const totalAfterFee = totalPrice - feeAmount;

  // Final check: does pool have enough balance?
  if (BigInt(pool.tokenBalance) < totalPrice) {
    return {
      poolId: pool.id,
      type: pool.type,
      price: '0',
      pricePerNFT: '0',
      numNFTs,
      fee: '0',
      spotPrice: pool.spotPrice,
      newSpotPrice: pool.spotPrice,
      available: false,
      reason: 'Insufficient pool token balance',
    };
  }

  return {
    poolId: pool.id,
    type: pool.type,
    price: totalAfterFee.toString(),
    pricePerNFT: (totalAfterFee / BigInt(numNFTs)).toString(),
    numNFTs,
    fee: feeAmount.toString(),
    spotPrice: pool.spotPrice,
    newSpotPrice: currentSpotPrice.toString(),
    available: true,
  };
}

/**
 * Get human-readable price quote
 */
export function formatPriceQuote(quote: PoolPriceQuote): string {
  if (!quote.available) {
    return `Not available: ${quote.reason}`;
  }

  const totalEth = formatWeiToEth(quote.price);
  const perNFT = formatWeiToEth(quote.pricePerNFT);
  const feeEth = formatWeiToEth(quote.fee);

  if (quote.numNFTs === 1) {
    return `${totalEth} ETH (fee: ${feeEth} ETH)`;
  }

  return `${totalEth} ETH total (${perNFT} ETH per NFT, fee: ${feeEth} ETH)`;
}

/**
 * Compare two price quotes and return the better one
 */
export function comparePriceQuotes(
  quote1: PoolPriceQuote,
  quote2: PoolPriceQuote,
  isBuying: boolean
): PoolPriceQuote {
  // If one is unavailable, return the other
  if (!quote1.available) return quote2;
  if (!quote2.available) return quote1;

  const price1 = BigInt(quote1.price);
  const price2 = BigInt(quote2.price);

  // When buying, prefer lower price
  // When selling, prefer higher price
  if (isBuying) {
    return price1 < price2 ? quote1 : quote2;
  } else {
    return price1 > price2 ? quote1 : quote2;
  }
}

/**
 * Calculate price impact for a trade
 */
export function calculatePriceImpact(
  pool: PoolData,
  numNFTs: number,
  isBuying: boolean
): number {
  const quote = isBuying
    ? calculateBuyPrice(pool, numNFTs)
    : calculateSellPrice(pool, numNFTs);

  if (!quote.available) return 0;

  const originalSpot = BigInt(pool.spotPrice);
  const newSpot = BigInt(quote.newSpotPrice);

  // Calculate percentage change
  const change = newSpot - originalSpot;
  const impact = Number((change * 10000n) / originalSpot) / 100;

  return Math.abs(impact);
}

/**
 * Estimate slippage for a trade
 */
export function estimateSlippage(
  pool: PoolData,
  numNFTs: number,
  isBuying: boolean,
  maxSlippageBps: number = 100 // 1% default
): { withinTolerance: boolean; slippage: number } {
  const priceImpact = calculatePriceImpact(pool, numNFTs, isBuying);

  return {
    withinTolerance: priceImpact <= maxSlippageBps / 100,
    slippage: priceImpact,
  };
}

/**
 * Get best quote from multiple pools
 */
export function getBestQuoteFromPools(
  pools: PoolData[],
  numNFTs: number,
  isBuying: boolean
): PoolPriceQuote | null {
  if (pools.length === 0) return null;

  const quotes = pools.map(pool =>
    isBuying ? calculateBuyPrice(pool, numNFTs) : calculateSellPrice(pool, numNFTs)
  );

  const availableQuotes = quotes.filter(q => q.available);
  if (availableQuotes.length === 0) return null;

  return availableQuotes.reduce((best, current) =>
    comparePriceQuotes(best, current, isBuying)
  );
}
