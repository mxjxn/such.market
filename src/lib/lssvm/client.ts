/**
 * LSSVM Subgraph Client
 * GraphQL client for querying LSSVM liquidity pools on Base
 */

import { GraphQLClient } from 'graphql-request';
import type { LSSVMError } from './types';

// Environment variable for subgraph URL
const LSSVM_SUBGRAPH_URL = process.env.LSSVM_SUBGRAPH_URL || process.env.NEXT_PUBLIC_LSSVM_SUBGRAPH_URL;

if (!LSSVM_SUBGRAPH_URL) {
  console.warn(
    '⚠️  LSSVM_SUBGRAPH_URL not set. LSSVM pool functionality will be disabled.\n' +
    '   Set LSSVM_SUBGRAPH_URL in your .env.local file to enable liquidity pools.\n' +
    '   Trading will fall back to Seaport listings only.'
  );
}

/**
 * Create GraphQL client for LSSVM subgraph
 */
export const lssvmClient = LSSVM_SUBGRAPH_URL
  ? new GraphQLClient(LSSVM_SUBGRAPH_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout after 10 seconds
      timeout: 10000,
    })
  : null;

/**
 * Query LSSVM subgraph with error handling and retries
 */
export async function queryLSSVM<T>(
  query: string,
  variables?: Record<string, any>,
  retries: number = 2
): Promise<T> {
  if (!lssvmClient) {
    throw createLSSVMError(
      'NETWORK_ERROR',
      'LSSVM subgraph client not initialized. Check LSSVM_SUBGRAPH_URL environment variable.'
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await lssvmClient.request<T>(query, variables);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(
        `LSSVM Subgraph query failed (attempt ${attempt + 1}/${retries + 1}):`,
        {
          error: lastError.message,
          query: query.substring(0, 100) + '...',
          variables,
        }
      );

      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries failed
  throw createLSSVMError(
    'NETWORK_ERROR',
    `Failed to query LSSVM subgraph after ${retries + 1} attempts: ${lastError?.message}`,
    { originalError: lastError }
  );
}

/**
 * Check if LSSVM integration is available
 */
export function isLSSVMAvailable(): boolean {
  return lssvmClient !== null;
}

/**
 * Create a standardized LSSVM error
 */
export function createLSSVMError(
  code: LSSVMError['code'],
  message: string,
  details?: any
): LSSVMError {
  return {
    code,
    message,
    details,
  };
}

/**
 * Validate pool data from subgraph response
 */
export function validatePoolData(pool: any): boolean {
  return Boolean(
    pool &&
    pool.id &&
    pool.type &&
    pool.spotPrice &&
    typeof pool.nftBalance === 'number' &&
    pool.tokenBalance !== undefined
  );
}

/**
 * Format wei to ETH string
 */
export function formatWeiToEth(wei: string | bigint): string {
  const weiAmount = typeof wei === 'string' ? BigInt(wei) : wei;
  const ethAmount = Number(weiAmount) / 1e18;
  return ethAmount.toFixed(6);
}

/**
 * Format ETH to wei string
 */
export function formatEthToWei(eth: string | number): string {
  const ethAmount = typeof eth === 'string' ? parseFloat(eth) : eth;
  return (BigInt(Math.floor(ethAmount * 1e18))).toString();
}

/**
 * Health check for LSSVM subgraph
 */
export async function healthCheck(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  if (!isLSSVMAvailable()) {
    return {
      available: false,
      error: 'LSSVM client not initialized',
    };
  }

  const startTime = Date.now();

  try {
    // Simple query to check if subgraph is responsive
    await queryLSSVM<{ pools: any[] }>(
      `query HealthCheck {
        pools(first: 1) {
          id
        }
      }`,
      {},
      0 // No retries for health check
    );

    return {
      available: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
