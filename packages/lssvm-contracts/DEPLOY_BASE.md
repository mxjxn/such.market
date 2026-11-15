# Base Mainnet Deployment Guide

This guide walks you through deploying your own factory and router contracts to Base Mainnet, reusing sudoswap's stateless bonding curves.

## Prerequisites

1. **Foundry installed**: `forge --version` should work
2. **Base Mainnet RPC**: Get an RPC endpoint (Alchemy, Infura, or public)
3. **Deployment account**: Account with sufficient ETH for gas fees
4. **Environment variables**: Set up in `.env.local` (see below)

## Step 1: Set Up Environment Variables

Create `packages/lssvm-contracts/.env.local` with the following:

```bash
# Network Configuration
RPC_URL=https://mainnet.base.org
# Or use your own RPC endpoint:
# RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Deployment Account
PRIVATE_KEY=your_private_key_here

# Contract Verification (optional but recommended)
ETHERSCAN_API_KEY=your_base_scan_api_key_here

# Contract Configuration
# Manifold Royalty Registry for Base Mainnet
# For Base and most EVM chains, use the universal address:
ROYALTY_REGISTRY=0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d

# Address that will receive protocol trading fees
PROTOCOL_FEE_RECIPIENT=0xYourFeeRecipientAddress

# Protocol fee multiplier (in base 1e18)
# Example: 0.01e18 = 1%, 0.05e18 = 5%
# Maximum: 0.1e18 (10%)
PROTOCOL_FEE_MULTIPLIER=10000000000000000

# Address that will own the factory contract
# This address can whitelist bonding curves, routers, and update fees
FACTORY_OWNER=0xYourFactoryOwnerAddress
```

**Important**: Replace all placeholder addresses with your actual addresses.

## Step 2: Deploy Contracts

Run the deployment script:

```bash
cd packages/lssvm-contracts

# Load environment variables
source .env.local

# Deploy all contracts
forge script script/DeployForBase.s.sol:DeployForBase \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --sender $(cast wallet address $PRIVATE_KEY) \
  -vvvv
```

The script will:
1. Deploy RoyaltyEngine
2. Deploy all 4 pair templates (ERC721ETH, ERC721ERC20, ERC1155ETH, ERC1155ERC20)
3. Deploy LSSVMPairFactory
4. Deploy VeryFastRouter
5. Automatically whitelist sudoswap's bonding curves (if deployer is factory owner)
6. Automatically whitelist the router (if deployer is factory owner)

## Step 3: Verify Deployment

After deployment, the script will print a summary with all contract addresses. Save these addresses!

Verify the factory was deployed correctly:

```bash
# Replace FACTORY_ADDRESS with the actual address from deployment
FACTORY_ADDRESS=0x...

cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url $RPC_URL
```

Verify bonding curves are whitelisted:

```bash
# Sudoswap bonding curve addresses (Base Mainnet)
LINEAR_CURVE=0xe41352CB8D9af18231E05520751840559C2a548A
EXPONENTIAL_CURVE=0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6
XYK_CURVE=0xd0A2f4ae5E816ec09374c67F6532063B60dE037B
GDA_CURVE=0x4f1627be4C72aEB9565D4c751550C4D262a96B51

cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $EXPONENTIAL_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $XYK_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $GDA_CURVE --rpc-url $RPC_URL
```

Verify router is whitelisted:

```bash
# Replace ROUTER_ADDRESS with the actual address from deployment
ROUTER_ADDRESS=0x...

cast call $FACTORY_ADDRESS "routerStatus(address)" $ROUTER_ADDRESS --rpc-url $RPC_URL
```

## Step 4: Manual Configuration (If Needed)

If the deployer is not the factory owner, you'll need to manually whitelist the bonding curves and router:

```bash
# Set your addresses
FACTORY_ADDRESS=0x...
ROUTER_ADDRESS=0x...
PRIVATE_KEY=your_private_key

# Whitelist bonding curves (Base Mainnet addresses)
cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  0xe41352CB8D9af18231E05520751840559C2a548A true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6 true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  0xd0A2f4ae5E816ec09374c67F6532063B60dE037B true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  0x4f1627be4C72aEB9565D4c751550C4D262a96B51 true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Whitelist router
cast send $FACTORY_ADDRESS \
  "setRouterAllowed(address,bool)" \
  $ROUTER_ADDRESS true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

## Step 5: Update Miniapp Configuration

After deployment, update `apps/miniapp/.env.local` with your deployed addresses:

```bash
# Base Mainnet (chainId: 8453)
NEXT_PUBLIC_FACTORY_ADDRESS_8453=0xYourFactoryAddress
NEXT_PUBLIC_ROUTER_ADDRESS_8453=0xYourRouterAddress

# RPC Configuration (if not already set)
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
# Or use your own RPC endpoint:
# NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# IPFS Configuration (optional)
NEXT_PUBLIC_IPFS_URL=https://ipfs.io
```

**Important**: Restart your Next.js dev server after updating `.env.local` for changes to take effect.

## Step 6: Test the Deployment

1. **Create a test pool**: Use the factory to create a test ERC721 pool
2. **Verify pool appears**: Check that the pool appears in the browse page at `/browse/[nftContractAddress]`
3. **Test buying**: Try buying an NFT from the pool
4. **Test selling**: Try selling an NFT to the pool

## Troubleshooting

### "Bonding curve not whitelisted" error
- Make sure you've whitelisted all 4 sudoswap bonding curves
- Verify the addresses are correct (use Base Mainnet addresses, not Ethereum Mainnet)
- If you accidentally whitelisted Ethereum addresses, use `fix-base-bonding-curves.sh` to fix it

### "Router not whitelisted" error
- Make sure you've whitelisted your router address in the factory
- Verify the router address is correct

### Factory owner mismatch
- If auto-configuration was skipped, manually configure using Step 4
- Make sure you're using the factory owner's private key

### Contracts not verified on BaseScan
- Make sure `ETHERSCAN_API_KEY` is set correctly
- BaseScan uses the same API as Etherscan
- You can verify manually later if needed

## Notes

- **Bonding curves**: The sudoswap bonding curves are deployed separately on Base Mainnet. Use the Base Mainnet addresses, not Ethereum Mainnet addresses.
- **Fee collection**: Your factory will collect protocol fees according to `PROTOCOL_FEE_MULTIPLIER` and send them to `PROTOCOL_FEE_RECIPIENT`.
- **Factory ownership**: The `FACTORY_OWNER` address has full control over the factory, including fee updates and whitelisting.

## Next Steps

After deployment:
1. Update the miniapp environment variables
2. Test pool creation and trading
3. Monitor fee collection
4. Consider setting up a subgraph for better pool discovery performance (see `FUTURE_INDEXING.md`)

