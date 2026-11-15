# Base Sepolia Testnet Deployment Guide

This guide walks you through deploying your own factory, router, and bonding curve contracts to Base Sepolia testnet.

## Prerequisites

1. **Foundry installed**: `forge --version` should work
2. **Base Sepolia RPC**: Get an RPC endpoint (Alchemy, Infura, or public)
3. **Testnet account**: Account with testnet ETH for gas fees
4. **Environment variables**: Set up in `.env.local` (see below)

## Step 1: Set Up Environment Variables

Create `packages/lssvm-contracts/.env.local` with the following:

```bash
# Network Configuration (Base Sepolia Testnet)
RPC_URL=https://sepolia.base.org
# Or use your own RPC endpoint:
# RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Deployment Account
PRIVATE_KEY=your_private_key_here
# Or use a mnemonic (will use index 2 by default):
# MNEMONIC="your twelve word seed phrase here"
# MNEMONIC_INDEX=2

# Contract Verification (optional but recommended)
ETHERSCAN_API_KEY=your_base_scan_api_key_here

# Contract Configuration
# Manifold Royalty Registry for Base Sepolia
# Check https://docs.manifold.xyz/v/manifold-for-developers/contract-docs/royalty-registry
# For testnet, you may need to deploy your own or use a testnet-specific address
ROYALTY_REGISTRY=0x0000000000000000000000000000000000000000

# Protocol Fee Configuration
PROTOCOL_FEE_RECIPIENT=0x0000000000000000000000000000000000000000
PROTOCOL_FEE_MULTIPLIER=10000000000000000  # 1% (0.01 * 1e18)

# Factory Owner (defaults to deployer address if not set)
FACTORY_OWNER=0x0000000000000000000000000000000000000000

# Bonding Curves (optional)
# Set to false to use existing bonding curve addresses
DEPLOY_BONDING_CURVES=true
# If DEPLOY_BONDING_CURVES=false, provide existing addresses:
# LINEAR_CURVE_ADDRESS=0x...
# EXPONENTIAL_CURVE_ADDRESS=0x...
# XYK_CURVE_ADDRESS=0x...
# GDA_CURVE_ADDRESS=0x...
```

## Step 2: Get Testnet ETH

You'll need testnet ETH for gas fees. Get it from:

- **Coinbase Base Sepolia Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Base Bridge**: https://bridge.base.org/deposit (bridge from Goerli/Sepolia)
- **Base Sepolia Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

Verify your balance:

```bash
cast balance YOUR_ADDRESS --rpc-url $RPC_URL
```

## Step 3: Deploy Contracts

Run the deployment script:

```bash
cd packages/lssvm-contracts
./deploy-base-testnet.sh
```

The script will:
1. Deploy bonding curves (LinearCurve, ExponentialCurve, XykCurve, GDACurve)
2. Deploy RoyaltyEngine
3. Deploy pair templates (ERC721ETH, ERC721ERC20, ERC1155ETH, ERC1155ERC20)
4. Deploy LSSVMPairFactory
5. Deploy VeryFastRouter
6. Configure factory (whitelist bonding curves and router)
7. Verify contracts on BaseScan Sepolia (if `ETHERSCAN_API_KEY` is set)

## Step 4: Verify Deployment

After deployment, verify the contracts are working:

```bash
# Set your addresses
FACTORY_ADDRESS=0x...
ROUTER_ADDRESS=0x...

# Check factory owner
cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL

# Check protocol fee recipient
cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url $RPC_URL
```

Verify bonding curves are whitelisted:

```bash
# Get bonding curve addresses from deployment output
LINEAR_CURVE=0x...
EXPONENTIAL_CURVE=0x...
XYK_CURVE=0x...
GDA_CURVE=0x...

cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $EXPONENTIAL_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $XYK_CURVE --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $GDA_CURVE --rpc-url $RPC_URL
```

Verify router is whitelisted:

```bash
# Replace ROUTER_ADDRESS with the actual address from deployment
cast call $FACTORY_ADDRESS "routerStatus(address)" $ROUTER_ADDRESS --rpc-url $RPC_URL
# Should return 0x...0001 (true) for the first 66 characters
```

## Step 5: Update Miniapp Configuration

Update `apps/miniapp/.env.local` with your deployed addresses:

```bash
# Base Sepolia Testnet (chainId: 84532)
NEXT_PUBLIC_FACTORY_ADDRESS_84532=0x...
NEXT_PUBLIC_ROUTER_ADDRESS_84532=0x...

# Base Sepolia RPC (optional, for better rate limits)
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

Restart your Next.js dev server for changes to take effect.

## Manual Configuration (if needed)

If the deployer is not the factory owner, you'll need to configure manually:

```bash
# Set your addresses
FACTORY_ADDRESS=0x...
ROUTER_ADDRESS=0x...
LINEAR_CURVE=0x...
EXPONENTIAL_CURVE=0x...
XYK_CURVE=0x...
GDA_CURVE=0x...
PRIVATE_KEY=your_private_key
RPC_URL=https://sepolia.base.org

# Whitelist bonding curves (Base Sepolia addresses)
cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $LINEAR_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $EXPONENTIAL_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $XYK_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $GDA_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Whitelist router
cast send $FACTORY_ADDRESS \
  "setRouterAllowed(address,bool)" \
  $ROUTER_ADDRESS true \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

## Testing Your Deployment

1. **Create a test pool**: Use the factory to create a new NFT pool
2. **Test buying**: Try buying an NFT from the pool
3. **Test selling**: Try selling an NFT to the pool

## Troubleshooting

### "Bonding curve not whitelisted" error
- Make sure you've whitelisted all 4 bonding curves
- Verify the addresses are correct (check deployment output)

### "Router not whitelisted" error
- Make sure you've whitelisted your router address in the factory
- Verify the router address is correct

### "Insufficient funds" error
- Get more testnet ETH from the faucet
- Check your balance: `cast balance YOUR_ADDRESS --rpc-url $RPC_URL`

### Contracts not verified on BaseScan
- Make sure `ETHERSCAN_API_KEY` is set correctly
- BaseScan Sepolia uses the same API as Etherscan
- You can verify manually later if needed

## Notes

- **Bonding curves**: By default, the script deploys new bonding curves. Set `DEPLOY_BONDING_CURVES=false` to use existing ones.
- **Fee collection**: Your factory will collect protocol fees according to `PROTOCOL_FEE_MULTIPLIER` and send them to `PROTOCOL_FEE_RECIPIENT`.
- **Factory ownership**: The `FACTORY_OWNER` address has full control over the factory, including fee updates and whitelisting.
- **Testnet vs Mainnet**: This deployment is for Base Sepolia testnet (chain ID 84532). For mainnet, use `deploy-base.sh`.

## Next Steps

After deployment:
1. Update the miniapp environment variables
2. Test creating pools and trading NFTs
3. Verify contracts on BaseScan Sepolia
4. When ready for mainnet, follow the [Base Mainnet Deployment Guide](./DEPLOY_BASE.md)

## Resources

- **Base Sepolia Explorer**: https://sepolia.basescan.org
- **Base Sepolia RPC**: https://sepolia.base.org
- **Base Documentation**: https://docs.base.org
- **Base Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

