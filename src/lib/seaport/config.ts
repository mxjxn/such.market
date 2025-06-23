// Seaport Configuration for Base Mainnet
export const SEAPORT_CONFIG = {
  // Base Mainnet addresses
  SEAPORT_V1_6: '0x0000000000000068F116a894984e2DB1123eB395',
  CONDUIT_CONTROLLER: '0x00000000F9490004C11Cef243f5400493c00Ad63',
  
  // Chain configuration
  CHAIN_ID: 8453, // Base
  RPC_URL: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
  
  // Default order parameters
  DEFAULT_ZONE: '0x004C00500000aD104D7DBd00e3ae0A5C00560C00',
  DEFAULT_CONDUIT_KEY: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000',
  
  // Platform settings
  PLATFORM_FEE_BPS: 250, // 2.5% in basis points
  PLATFORM_FEE_RECIPIENT: process.env.PLATFORM_FEE_RECIPIENT || '0x0000000000000000000000000000000000000000',
  
  // Order settings
  DEFAULT_LISTING_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
  DEFAULT_OFFER_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
  
  // Supported currencies
  SUPPORTED_CURRENCIES: {
    ETH: '0x0000000000000000000000000000000000000000',
    WETH: '0x4200000000000000000000000000000000000006', // Base WETH
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
  },
  
  // Gas settings
  GAS_LIMIT: 500000,
  GAS_PRICE: 'auto', // Let the wallet estimate
} as const;

// ItemType enum values
export const ITEM_TYPES = {
  NATIVE: 0,           // ETH, MATIC, etc.
  ERC20: 1,           // ERC20 tokens
  ERC721: 2,          // ERC721 NFTs
  ERC1155: 3,         // ERC1155 tokens
  ERC721_WITH_CRITERIA: 4,  // ERC721 with merkle criteria
  ERC1155_WITH_CRITERIA: 5  // ERC1155 with merkle criteria
} as const;

// OrderType enum values
export const ORDER_TYPES = {
  FULL_OPEN: 0,           // No partial fills, anyone can execute
  PARTIAL_OPEN: 1,        // Partial fills, anyone can execute
  FULL_RESTRICTED: 2,     // No partial fills, restricted execution
  PARTIAL_RESTRICTED: 3,  // Partial fills, restricted execution
  CONTRACT: 4            // Contract order type
} as const;

// BasicOrderType enum values for common trades
export const BASIC_ORDER_TYPES = {
  ETH_TO_ERC721_FULL_OPEN: 0,
  ETH_TO_ERC721_PARTIAL_OPEN: 1,
  ETH_TO_ERC721_FULL_RESTRICTED: 2,
  ETH_TO_ERC721_PARTIAL_RESTRICTED: 3,
  ETH_TO_ERC1155_FULL_OPEN: 4,
  ETH_TO_ERC1155_PARTIAL_OPEN: 5,
  ETH_TO_ERC1155_FULL_RESTRICTED: 6,
  ETH_TO_ERC1155_PARTIAL_RESTRICTED: 7,
  ERC20_TO_ERC721_FULL_OPEN: 8,
  ERC20_TO_ERC721_PARTIAL_OPEN: 9,
  ERC20_TO_ERC721_FULL_RESTRICTED: 10,
  ERC20_TO_ERC721_PARTIAL_RESTRICTED: 11,
  ERC20_TO_ERC1155_FULL_OPEN: 12,
  ERC20_TO_ERC1155_PARTIAL_OPEN: 13,
  ERC20_TO_ERC1155_FULL_RESTRICTED: 14,
  ERC20_TO_ERC1155_PARTIAL_RESTRICTED: 15,
  ERC721_TO_ERC20_FULL_OPEN: 16,
  ERC721_TO_ERC20_PARTIAL_OPEN: 17,
  ERC721_TO_ERC20_FULL_RESTRICTED: 18,
  ERC721_TO_ERC20_PARTIAL_RESTRICTED: 19,
  ERC1155_TO_ERC20_FULL_OPEN: 20,
  ERC1155_TO_ERC20_PARTIAL_OPEN: 21,
  ERC1155_TO_ERC20_FULL_RESTRICTED: 22,
  ERC1155_TO_ERC20_PARTIAL_RESTRICTED: 23
} as const;

// Type definitions
export type ItemType = typeof ITEM_TYPES[keyof typeof ITEM_TYPES];
export type OrderType = typeof ORDER_TYPES[keyof typeof ORDER_TYPES];
export type BasicOrderType = typeof BASIC_ORDER_TYPES[keyof typeof BASIC_ORDER_TYPES];
export type SupportedCurrency = keyof typeof SEAPORT_CONFIG.SUPPORTED_CURRENCIES; 