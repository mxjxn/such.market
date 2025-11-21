/**
 * Seaport Configuration for Base Mainnet
 * 
 * Contract addresses from OpenSea's Seaport v1.6 deployment on Base
 */

/**
 * Get RPC URL with fallback warnings
 */
function getRpcUrl(): string {
  const rpcUrl = process.env.BASE_MAINNET_RPC ||
                 process.env.NEXT_PUBLIC_BASE_MAINNET_RPC ||
                 'https://mainnet.base.org';

  if (rpcUrl === 'https://mainnet.base.org') {
    console.warn(
      '⚠️  Using public Base RPC endpoint (https://mainnet.base.org)\n' +
      '   This endpoint is rate-limited and not recommended for production.\n' +
      '   Set BASE_MAINNET_RPC environment variable with your Alchemy, Infura, or QuickNode URL.\n' +
      '   See .env.example for details.'
    );
  }

  return rpcUrl;
}

export const SEAPORT_CONFIG = {
  // Seaport v1.6 contract address on Base Mainnet
  SEAPORT_V1_6: '0x0000000000000068F116a894984e2DB1123eB395' as const,

  // Conduit Controller address
  CONDUIT_CONTROLLER: '0x00000000F9490004C11Cef243f5400493c00Ad63' as const,

  // Default Zone (OpenSea's zone contract)
  DEFAULT_ZONE: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00' as const,

  // Default Conduit Key
  DEFAULT_CONDUIT_KEY: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000' as const,

  // Chain configuration
  CHAIN_ID: 8453, // Base Mainnet
  RPC_URL: getRpcUrl(),

  // Default order parameters
  DEFAULT_ORDER_DURATION_DAYS: 7, // Orders expire after 7 days by default
} as const;

/**
 * EIP-712 Domain for Seaport on Base Mainnet
 */
export const SEAPORT_DOMAIN = {
  name: 'Seaport',
  version: '1.6',
  chainId: SEAPORT_CONFIG.CHAIN_ID,
  verifyingContract: SEAPORT_CONFIG.SEAPORT_V1_6,
} as const;

