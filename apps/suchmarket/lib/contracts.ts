import { Address } from 'viem'
import { CONFIG } from './config'
import {
  getRouterAddress as getRouterAddressFromAbis,
  getFactoryAddress as getFactoryAddressFromAbis,
} from '@mxjxn/lssvm-abis'

// Re-export everything from @mxjxn/lssvm-abis for backward compatibility
export * from '@mxjxn/lssvm-abis'

// Contract addresses - these should be set via environment variables
// Format: NEXT_PUBLIC_ROUTER_ADDRESS_8453 for Base mainnet (chainId 8453)
// This wrapper adds support for environment variable overrides
export function getRouterAddress(chainId: number): Address {
  // Use config file which has the env vars embedded at build time
  let address: Address | undefined
  
  if (chainId === 8453) {
    address = CONFIG.ROUTER_ADDRESS_8453 as Address | undefined
  } else if (chainId === 84532) {
    address = CONFIG.ROUTER_ADDRESS_84532 as Address | undefined
  } else if (chainId === 1 && CONFIG.ROUTER_ADDRESS_1) {
    address = CONFIG.ROUTER_ADDRESS_1 as Address
  }
  
  // Fallback to direct env access (for other chains or if config didn't work)
  if (!address) {
    const envKey = `NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`
    address = process.env[envKey] as Address | undefined
  }
  
  // If still no address, use the default from @lssvm/abis
  if (!address) {
    try {
      address = getRouterAddressFromAbis(chainId)
    } catch {
      throw new Error(`Router address not configured for chain ${chainId}. Set NEXT_PUBLIC_ROUTER_ADDRESS_${chainId} in your environment variables.`)
    }
  }
  
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('=== Router Address Debug ===')
    console.log('Chain ID:', chainId)
    console.log('Address from CONFIG:', chainId === 8453 ? CONFIG.ROUTER_ADDRESS_8453 : chainId === 84532 ? CONFIG.ROUTER_ADDRESS_84532 : 'N/A')
    console.log('Address from env:', process.env[`NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`])
    console.log('Final address:', address)
    console.log('===========================')
  }
  
  return address
}

export function getFactoryAddress(chainId: number): Address {
  // Use config file which has the env vars embedded at build time
  let address: Address | undefined
  
  if (chainId === 8453) {
    address = CONFIG.FACTORY_ADDRESS_8453 as Address | undefined
  } else if (chainId === 84532) {
    address = CONFIG.FACTORY_ADDRESS_84532 as Address | undefined
  } else if (chainId === 1 && CONFIG.FACTORY_ADDRESS_1) {
    address = CONFIG.FACTORY_ADDRESS_1 as Address
  }
  
  // Fallback to direct env access
  if (!address) {
    const envKey = `NEXT_PUBLIC_FACTORY_ADDRESS_${chainId}`
    address = process.env[envKey] as Address | undefined
  }
  
  // If still no address, use the default from @lssvm/abis
  if (!address) {
    try {
      address = getFactoryAddressFromAbis(chainId)
    } catch {
      throw new Error(`Factory address not configured for chain ${chainId}. Set NEXT_PUBLIC_FACTORY_ADDRESS_${chainId} in your environment variables.`)
    }
  }
  
  return address
}
