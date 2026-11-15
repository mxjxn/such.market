# @lssvm/abis

Shared ABIs, addresses, and TypeScript types for LSSVM (Liquidity-Sensitive Single-Variant Market) contracts.

## Installation

```bash
npm install @lssvm/abis
# or
pnpm add @lssvm/abis
# or
yarn add @lssvm/abis
```

## Usage

```typescript
import { 
  LSSVM_PAIR_ABI, 
  LSSVM_FACTORY_ABI, 
  LSSVM_ROUTER_ABI,
  getRouterAddress,
  getFactoryAddress,
  PoolType 
} from '@lssvm/abis'

// Get contract addresses for a chain
const routerAddress = getRouterAddress(8453) // Base Mainnet
const factoryAddress = getFactoryAddress(8453)

// Use ABIs with viem
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({
  chain: base,
  transport: http()
})

const poolData = await client.readContract({
  address: poolAddress,
  abi: LSSVM_PAIR_ABI,
  functionName: 'spotPrice'
})
```

## Exports

### ABIs
- `LSSVM_PAIR_ABI` - LSSVM Pair contract ABI
- `LSSVM_FACTORY_ABI` - LSSVM Factory contract ABI
- `LSSVM_ROUTER_ABI` - LSSVM Router contract ABI
- `ERC721_ABI` - Standard ERC721 ABI
- `ERC1155_ABI` - Standard ERC1155 ABI
- `ERC20_ABI` - Standard ERC20 ABI

### Address Helpers
- `getRouterAddress(chainId)` - Get router address for a chain
- `getFactoryAddress(chainId)` - Get factory address for a chain
- `getBondingCurveAddress(chainId, curveType)` - Get bonding curve address

### Types
- `PoolType` - Enum for pool types (NFT, TOKEN, TRADE)
- `CurveError` - Error types for curve operations
- `PoolData` - Type for pool data structure
- `BuyNFTQuote`, `SellNFTQuote` - Quote types for NFT trades

## Supported Chains

- **Base Mainnet** (8453)
- **Base Sepolia Testnet** (84532)

## License

AGPL-3.0

## Repository

Part of the [LSSVM Development Suite](https://github.com/mxjxn/such-lssvm).

