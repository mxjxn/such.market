import { Address } from 'viem'

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES = {
  8453: {
    // Base Mainnet
    ROUTER: '0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C' as Address,
    FACTORY: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e' as Address,
  },
  84532: {
    // Base Sepolia Testnet
    ROUTER: '0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3' as Address,
    FACTORY: '0x372990Fd91CF61967325dD5270f50c4192bfb892' as Address,
  },
} as const

// Bonding curve addresses by chain
export const BONDING_CURVES = {
  8453: {
    // Base Mainnet
    LINEAR: '0xe41352CB8D9af18231E05520751840559C2a548A' as Address,
    EXPONENTIAL: '0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6' as Address,
    XYK: '0xd0A2f4ae5E816ec09374c67F6532063B60dE037B' as Address,
    GDA: '0x4f1627be4C72aEB9565D4c751550C4D262a96B51' as Address,
  },
  84532: {
    // Base Sepolia Testnet
    LINEAR: '0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0' as Address,
    EXPONENTIAL: '0x4637d06530d5D375B1D5dE1117C98b0c6EA7eDd1' as Address,
    XYK: '0xC4DfB54Ca18c9e5EC2a23e8DE09588982A6b2242' as Address,
    GDA: '0x60bAB2734eb85F07Ca93E3B7Fb1015fcc5e9CbA7' as Address,
  },
} as const

/**
 * Get the router address for a given chain ID
 */
export function getRouterAddress(chainId: number): Address {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]
  if (!addresses) {
    throw new Error(`Router address not configured for chain ${chainId}`)
  }
  return addresses.ROUTER
}

/**
 * Get the factory address for a given chain ID
 */
export function getFactoryAddress(chainId: number): Address {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES]
  if (!addresses) {
    throw new Error(`Factory address not configured for chain ${chainId}`)
  }
  return addresses.FACTORY
}

/**
 * Get the bonding curve address for a given chain ID and curve type
 */
export function getBondingCurveAddress(
  chainId: number,
  curveType: 'LINEAR' | 'EXPONENTIAL' | 'XYK' | 'GDA'
): Address {
  const curves = BONDING_CURVES[chainId as keyof typeof BONDING_CURVES]
  if (!curves) {
    throw new Error(`Bonding curves not configured for chain ${chainId}`)
  }
  return curves[curveType]
}

