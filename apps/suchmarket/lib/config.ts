/**
 * Application configuration
 * These values are embedded at build time from environment variables
 * 
 * IMPORTANT: Restart the dev server after changing .env.local for these to take effect
 */

// Hardcoded fallback addresses for Base Mainnet (8453) and Base Sepolia (84532)
// These will be overridden by environment variables if set
const HARDCODED_ADDRESSES = {
  8453: {
    ROUTER: '0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C',
    FACTORY: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e',
  },
  84532: {
    ROUTER: '0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3',
    FACTORY: '0x372990Fd91CF61967325dD5270f50c4192bfb892',
  },
}

export const CONFIG = {
  ROUTER_ADDRESS_8453: process.env.NEXT_PUBLIC_ROUTER_ADDRESS_8453 || HARDCODED_ADDRESSES[8453].ROUTER,
  FACTORY_ADDRESS_8453: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_8453 || HARDCODED_ADDRESSES[8453].FACTORY,
  ROUTER_ADDRESS_84532: process.env.NEXT_PUBLIC_ROUTER_ADDRESS_84532 || HARDCODED_ADDRESSES[84532].ROUTER,
  FACTORY_ADDRESS_84532: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_84532 || HARDCODED_ADDRESSES[84532].FACTORY,
  ROUTER_ADDRESS_1: process.env.NEXT_PUBLIC_ROUTER_ADDRESS_1 || '',
  FACTORY_ADDRESS_1: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_1 || '',
  BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  BASE_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  ETHEREUM_RPC_URL: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com',
  IPFS_URL: process.env.NEXT_PUBLIC_IPFS_URL || 'https://ipfs.io',
} as const


