'use client'

import { Address, formatUnits, parseUnits, zeroAddress } from 'viem'
import { getPublicClient } from './wagmi'
import { LSSVM_PAIR_ABI, PoolData, PoolType } from './contracts'

/**
 * Fetch pool data from a pair contract
 */
export async function fetchPoolData(pairAddress: Address, chainId: number): Promise<PoolData | null> {
  try {
    const client = getPublicClient(chainId)
    
    // First, check if the address is actually a contract
    const code = await client.getBytecode({ address: pairAddress })
    if (!code || code === '0x') {
      throw new Error(`Address ${pairAddress} is not a contract`)
    }

    // Try to read a simple function first to verify it's a pool contract
    // Use poolType as a validation check - if this fails, it's not a valid pool
    let poolType: number
    try {
      poolType = await client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'poolType',
      }) as number
    } catch (error: any) {
      // Check if it's a "no data" error
      if (error?.message?.includes('returned no data') || error?.message?.includes('0x')) {
        throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
      }
      throw error
    }
    
    // Fetch remaining pool info
    const [spotPrice, delta, fee, nft, bondingCurve] = await Promise.all([
      client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'spotPrice',
      }).catch((err) => {
        if (err?.message?.includes('returned no data')) {
          throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
        }
        throw err
      }),
      client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'delta',
      }).catch((err) => {
        if (err?.message?.includes('returned no data')) {
          throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
        }
        throw err
      }),
      client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'fee',
      }).catch((err) => {
        if (err?.message?.includes('returned no data')) {
          throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
        }
        throw err
      }),
      client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'nft',
      }).catch((err) => {
        if (err?.message?.includes('returned no data')) {
          throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
        }
        throw err
      }),
      client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'bondingCurve',
      }).catch((err) => {
        if (err?.message?.includes('returned no data')) {
          throw new Error(`Address ${pairAddress} is not a valid LSSVM pool contract`)
        }
        throw err
      }),
    ])

    // Try to fetch token address - ETH pairs don't have this function
    let token: Address = zeroAddress
    try {
      const tokenResult = await client.readContract({
        address: pairAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'token',
      })
      token = tokenResult as Address
    } catch (error) {
      // If token() reverts, it's likely an ETH pair - use zero address to indicate ETH
      console.log('token() call reverted, assuming ETH pair')
      token = zeroAddress
    }

    return {
      address: pairAddress,
      poolType: poolType as PoolType,
      spotPrice: spotPrice as bigint,
      delta: delta as bigint,
      fee: fee as bigint,
      nft: nft as Address,
      token: token,
      bondingCurve: bondingCurve as Address,
    }
  } catch (error) {
    console.error('Error fetching pool data:', error)
    // Throw error so React Query can properly handle it
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch pool data: ${error}`)
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: bigint, decimals: number = 18): string {
  return formatUnits(price, decimals)
}

/**
 * Parse price from string
 */
export function parsePrice(price: string, decimals: number = 18): bigint {
  return parseUnits(price, decimals)
}

