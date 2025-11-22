/**
 * LSSVM Subgraph Queries
 * GraphQL queries for fetching pool data and liquidity information
 */

import { gql } from 'graphql-request';
import { queryLSSVM, validatePoolData, createLSSVMError } from './client';
import type { PoolData, CollectionLiquidity, PoolTradeType } from './types';

/**
 * GraphQL query for collection pools
 */
const GET_COLLECTION_POOLS = gql`
  query CollectionPools($collection: String!) {
    pools(where: { collection: $collection, active: true }) {
      id
      collection {
        id
        name
        symbol
      }
      type
      tradeType
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
      active
      owner
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL query for best buy pool (lowest price to buy from pool)
 */
const GET_BEST_BUY_POOL = gql`
  query BestBuyPool($collection: String!) {
    pools(
      where: {
        collection: $collection,
        active: true,
        nftBalance_gt: 0,
        tradeType_in: ["SELL", "TRADE"]
      }
      orderBy: spotPrice
      orderDirection: asc
      first: 1
    ) {
      id
      collection {
        id
        name
      }
      type
      tradeType
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
      active
      owner
    }
  }
`;

/**
 * GraphQL query for best sell pool (highest price to sell to pool)
 */
const GET_BEST_SELL_POOL = gql`
  query BestSellPool($collection: String!) {
    pools(
      where: {
        collection: $collection,
        active: true,
        tokenBalance_gt: 0,
        tradeType_in: ["BUY", "TRADE"]
      }
      orderBy: spotPrice
      orderDirection: desc
      first: 1
    ) {
      id
      collection {
        id
        name
      }
      type
      tradeType
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
      active
      owner
    }
  }
`;

/**
 * GraphQL query for specific pool by ID
 */
const GET_POOL_BY_ID = gql`
  query PoolById($id: ID!) {
    pool(id: $id) {
      id
      collection {
        id
        name
        symbol
      }
      type
      tradeType
      spotPrice
      delta
      fee
      nftBalance
      tokenBalance
      active
      owner
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get all active pools for a collection
 */
export async function getCollectionPools(collection: string): Promise<PoolData[]> {
  try {
    const result = await queryLSSVM<{ pools: PoolData[] }>(
      GET_COLLECTION_POOLS,
      { collection: collection.toLowerCase() }
    );

    // Validate pool data
    const validPools = result.pools.filter(validatePoolData);

    if (validPools.length !== result.pools.length) {
      console.warn(
        `Some pools had invalid data and were filtered out. ` +
        `Valid: ${validPools.length}, Total: ${result.pools.length}`
      );
    }

    return validPools;
  } catch (error) {
    console.error('Error fetching collection pools:', error);
    return [];
  }
}

/**
 * Get best pool to buy NFTs from (lowest price)
 */
export async function getBestBuyPool(collection: string): Promise<PoolData | null> {
  try {
    const result = await queryLSSVM<{ pools: PoolData[] }>(
      GET_BEST_BUY_POOL,
      { collection: collection.toLowerCase() }
    );

    const pool = result.pools[0];
    return pool && validatePoolData(pool) ? pool : null;
  } catch (error) {
    console.error('Error fetching best buy pool:', error);
    return null;
  }
}

/**
 * Get best pool to sell NFTs to (highest offer price)
 */
export async function getBestSellPool(collection: string): Promise<PoolData | null> {
  try {
    const result = await queryLSSVM<{ pools: PoolData[] }>(
      GET_BEST_SELL_POOL,
      { collection: collection.toLowerCase() }
    );

    const pool = result.pools[0];
    return pool && validatePoolData(pool) ? pool : null;
  } catch (error) {
    console.error('Error fetching best sell pool:', error);
    return null;
  }
}

/**
 * Get specific pool by ID
 */
export async function getPoolById(poolId: string): Promise<PoolData | null> {
  try {
    const result = await queryLSSVM<{ pool: PoolData | null }>(
      GET_POOL_BY_ID,
      { id: poolId }
    );

    const pool = result.pool;
    return pool && validatePoolData(pool) ? pool : null;
  } catch (error) {
    console.error('Error fetching pool by ID:', error);
    return null;
  }
}

/**
 * Get complete liquidity information for a collection
 */
export async function getCollectionLiquidity(
  collection: string
): Promise<CollectionLiquidity> {
  const pools = await getCollectionPools(collection);

  // Calculate totals
  const totalNFTBalance = pools.reduce((sum, pool) => sum + pool.nftBalance, 0);
  const totalTokenBalance = pools.reduce(
    (sum, pool) => (BigInt(sum) + BigInt(pool.tokenBalance)).toString(),
    '0'
  );

  // Find best prices
  const buyPools = pools.filter(p =>
    p.tradeType === 'SELL' || p.tradeType === 'TRADE'
  ).filter(p => p.nftBalance > 0);
  const sellPools = pools.filter(p =>
    p.tradeType === 'BUY' || p.tradeType === 'TRADE'
  ).filter(p => BigInt(p.tokenBalance) > 0n);

  const bestBuyPrice = buyPools.length > 0
    ? buyPools.sort((a, b) => {
        return BigInt(a.spotPrice) < BigInt(b.spotPrice) ? -1 : 1;
      })[0].spotPrice
    : null;

  const bestSellPrice = sellPools.length > 0
    ? sellPools.sort((a, b) => {
        return BigInt(a.spotPrice) > BigInt(b.spotPrice) ? -1 : 1;
      })[0].spotPrice
    : null;

  return {
    collection: collection.toLowerCase(),
    totalPools: pools.length,
    totalNFTBalance,
    totalTokenBalance,
    bestBuyPrice,
    bestSellPrice,
    pools,
  };
}

/**
 * Check if a collection has any active liquidity
 */
export async function hasLiquidity(collection: string): Promise<boolean> {
  const pools = await getCollectionPools(collection);
  return pools.length > 0 && (
    pools.some(p => p.nftBalance > 0) ||
    pools.some(p => BigInt(p.tokenBalance) > 0n)
  );
}

/**
 * Get pools by trade type
 */
export async function getPoolsByTradeType(
  collection: string,
  tradeType: PoolTradeType
): Promise<PoolData[]> {
  const pools = await getCollectionPools(collection);
  return pools.filter(pool => pool.tradeType === tradeType);
}
