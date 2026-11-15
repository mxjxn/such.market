# sudoAMM v2 Deployment Guide

This directory contains deployment scripts for the sudoAMM v2 protocol. The scripts are organized to deploy contracts in the correct dependency order.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Deployment Order](#deployment-order)
- [Environment Variables](#environment-variables)
- [Deployment Scripts](#deployment-scripts)
- [Usage](#usage)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Network-Specific Addresses](#network-specific-addresses)

## Overview

The sudoAMM v2 protocol consists of several components that must be deployed in a specific order due to dependencies between contracts. The deployment can be done either:

1. **All at once** using `DeployAll.s.sol` (recommended for testing/development)
2. **Step by step** using individual scripts (recommended for production)

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- RPC endpoint for target network
- Private key or mnemonic for deployment account
- Sufficient native token (ETH/MATIC/etc.) for gas fees
- Etherscan API key (optional, for contract verification)

## Deployment Order

The contracts must be deployed in the following order:

```
1. RoyaltyEngine
   └── Requires: Manifold Royalty Registry address (external)

2. Pair Templates (all require RoyaltyEngine)
   ├── LSSVMPairERC721ETH
   ├── LSSVMPairERC721ERC20
   ├── LSSVMPairERC1155ETH
   └── LSSVMPairERC1155ERC20

3. LSSVMPairFactory
   └── Requires: All 4 pair templates

4. Bonding Curves (independent)
   ├── LinearCurve
   ├── ExponentialCurve
   ├── XykCurve
   └── GDACurve

5. VeryFastRouter
   └── Requires: LSSVMPairFactory

6. Property Checker Templates (independent)
   ├── MerklePropertyChecker
   └── RangePropertyChecker

7. PropertyCheckerFactory
   └── Requires: Property checker templates

8. Settings Components
   ├── Splitter (independent)
   ├── StandardSettings (requires Splitter + Factory)
   └── StandardSettingsFactory (requires StandardSettings)
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Network Configuration
RPC_URL=<your_rpc_url>
ETHERSCAN_API_KEY=<your_etherscan_api_key>

# Deployment Account
PRIVATE_KEY=<your_private_key>
# OR
MNEMONIC=<your_mnemonic>

# Contract Configuration
ROYALTY_REGISTRY=<manifold_royalty_registry_address>
PROTOCOL_FEE_RECIPIENT=<address_to_receive_fees>
PROTOCOL_FEE_MULTIPLIER=<fee_in_1e18_basis_max_0.1e18>
FACTORY_OWNER=<address_that_will_own_factory>
```

### Configuration Details

**ROYALTY_REGISTRY**: Address of the Manifold Royalty Registry for your network
- Ethereum Mainnet: `0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d`
- See [Network-Specific Addresses](#network-specific-addresses) for other networks

**PROTOCOL_FEE_RECIPIENT**: Address that will receive protocol trading fees

**PROTOCOL_FEE_MULTIPLIER**: Protocol fee as a multiplier in base 1e18
- Example: `0.01e18` = 1%, `0.05e18` = 5%
- Maximum: `0.1e18` (10%)

**FACTORY_OWNER**: Address that will have ownership of the factory contract
- Can whitelist bonding curves
- Can whitelist routers
- Can update protocol fees
- Can enable settings for collections

## Deployment Scripts

### Individual Scripts

| Script | Purpose | Dependencies |
|--------|---------|--------------|
| `01_DeployCore.s.sol` | Deploy core contracts (RoyaltyEngine, Templates, Factory) | ROYALTY_REGISTRY |
| `02_DeployBondingCurves.s.sol` | Deploy all bonding curve contracts | None |
| `03_DeployRouter.s.sol` | Deploy VeryFastRouter | FACTORY_ADDRESS |
| `04_DeployPropertyCheckers.s.sol` | Deploy property checker system | None |
| `05_DeploySettings.s.sol` | Deploy settings system | FACTORY_ADDRESS |

### Master Script

| Script | Purpose |
|--------|---------|
| `DeployAll.s.sol` | Deploy entire protocol in one go |

## Usage

### Option 1: Deploy All Contracts at Once

This is the simplest approach for development/testing:

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 2. Load environment variables
source .env

# 3. Deploy all contracts
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

### Option 2: Step-by-Step Deployment

This approach gives more control and is recommended for production:

```bash
# Load environment variables
source .env

# Step 1: Deploy core contracts
forge script script/01_DeployCore.s.sol:DeployCore \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Save the FACTORY_ADDRESS from output and add to .env
export FACTORY_ADDRESS=<factory_address_from_step_1>

# Step 2: Deploy bonding curves
forge script script/02_DeployBondingCurves.s.sol:DeployBondingCurves \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Step 3: Deploy router
forge script script/03_DeployRouter.s.sol:DeployRouter \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Step 4: Deploy property checkers
forge script script/04_DeployPropertyCheckers.s.sol:DeployPropertyCheckers \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv

# Step 5: Deploy settings
forge script script/05_DeploySettings.s.sol:DeploySettings \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

### Dry Run (Simulation)

Before broadcasting transactions, you can simulate the deployment:

```bash
# Simulate without --broadcast flag
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  -vvvv
```

## Local Testing

Before deploying to testnet or mainnet, it's highly recommended to test deployments locally. This helps catch configuration errors and ensures everything works as expected.

**📖 For comprehensive local testing instructions, see [LOCAL_TESTING.md](../LOCAL_TESTING.md)**

The guide covers:
- Complete deployment workflow
- Factory configuration (automatic and manual)
- Testing ERC721 pools (create, buy, sell)
- Testing ERC1155 pools (create, buy, sell)
- Useful cast commands for querying contracts
- Troubleshooting common issues

### Option 1: Local Anvil Node (Recommended for First-Time Testing)

Anvil is Foundry's local Ethereum node. It's perfect for testing deployments without any external dependencies:

```bash
# Terminal 1: Start Anvil (local node)
anvil

# This will output something like:
# Available Accounts
# ==================
# (0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
# ...
# Private Keys
# ==================
# (0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# ...
# RPC URL: http://127.0.0.1:8545
```

Create a `.env.local` file for local testing:

```bash
# .env.local
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# For local testing, you can use any address - RoyaltyEngine will fallback gracefully
# Option 1: Use address(0) - royalties won't work but deployment will succeed
ROYALTY_REGISTRY=0x0000000000000000000000000000000000000000

# Option 2: Deploy a mock registry (see test files for examples)
# Option 3: Use a real testnet address if you're forking

# Use the first Anvil account for everything
PROTOCOL_FEE_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
PROTOCOL_FEE_MULTIPLIER=10000000000000000  # 0.01e18 = 1%
FACTORY_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**Note**: The `RoyaltyEngine` contract accepts any address. If the registry call fails, it gracefully falls back to using the token address itself for ERC2981 lookups. For local testing without royalties, `address(0)` works fine.

```bash
# Terminal 2: Deploy to local Anvil node
cd packages/lssvm-contracts
source .env.local

# Deploy all contracts
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvvv
```

After deployment, you can interact with the contracts using `cast`:

```bash
# Check factory owner
cast call <FACTORY_ADDRESS> "owner()" --rpc-url http://127.0.0.1:8545

# Check protocol fee recipient
cast call <FACTORY_ADDRESS> "protocolFeeRecipient()" --rpc-url http://127.0.0.1:8545
```

### Option 2: Forked Testnet (More Realistic)

For more realistic testing, you can fork a testnet (like Base Sepolia) and deploy to the fork:

```bash
# Start Anvil with a testnet fork
anvil --fork-url https://sepolia.base.org

# Or fork Ethereum Sepolia
anvil --fork-url https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

This gives you:
- Real contract addresses (like the Manifold Royalty Registry)
- Real token addresses if you want to test with actual NFTs
- More realistic gas costs and behavior

Use the same deployment commands as Option 1, but with testnet addresses in your `.env.local`:

```bash
# .env.local for forked testnet
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=<your_test_account_private_key>

# Use real testnet addresses (check Network-Specific Addresses section for testnet registry addresses)
ROYALTY_REGISTRY=0x0000000000000000000000000000000000000000  # Replace with actual testnet registry
PROTOCOL_FEE_RECIPIENT=<your_address>
PROTOCOL_FEE_MULTIPLIER=10000000000000000
FACTORY_OWNER=<your_address>
```

### Testing Checklist

After local deployment, verify:

1. **Factory Deployment**
   ```bash
   cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL
   # Should return your FACTORY_OWNER address
   ```

2. **Bonding Curves Whitelisted**
   ```bash
   cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL
   # Should return 0x0000000000000000000000000000000000000000000000000000000000000001 (true)
   ```

3. **Router Whitelisted**
   ```bash
   cast call $FACTORY_ADDRESS "routerAllowed(address)" $ROUTER_ADDRESS --rpc-url $RPC_URL
   # Should return true
   ```

4. **Create a Test Pool** (if you have test NFTs)
   - Use the factory to create a test pool
   - Verify the pool was created correctly

### Troubleshooting Local Deployments

**Issue**: "execution reverted" errors
- **Solution**: Check that all environment variables are set correctly, especially addresses are valid

**Issue**: "insufficient funds"
- **Solution**: Anvil accounts start with 10000 ETH, but if using a fork, ensure your account has funds

**Issue**: "ROYALTY_REGISTRY not found"
- **Solution**: For local testing without a fork, you may need to deploy a mock royalty registry or use a valid address format

## Post-Deployment Configuration

After deployment, the following configuration steps must be performed by the factory owner:

### 1. Whitelist Bonding Curves

The bonding curves must be whitelisted in the factory to be usable:

```solidity
// Call these on LSSVMPairFactory
factory.setBondingCurveAllowed(linearCurveAddress, true);
factory.setBondingCurveAllowed(exponentialCurveAddress, true);
factory.setBondingCurveAllowed(xykCurveAddress, true);
factory.setBondingCurveAllowed(gdaCurveAddress, true);
```

### 2. Whitelist Router

The VeryFastRouter must be whitelisted to interact with pairs:

```solidity
factory.setRouterAllowed(veryFastRouterAddress, true);
```

### 3. (Optional) Enable Call Targets

If you want to allow specific contracts to be called by pairs:

```solidity
factory.setCallAllowed(targetAddress, true);
```

**Note**: The `DeployAll.s.sol` script automatically performs steps 1 and 2 if the deployer is the factory owner.

## Network-Specific Addresses

### Manifold Royalty Registry Addresses

| Network | Address |
|---------|---------|
| Ethereum Mainnet | `0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d` |
| Goerli | `0xe7c9cb6d966f76f3b5142167088927bf34966a1f` |
| Polygon | `0x28EdFcF0Be7E86b07493466e7631a213bDe8eEF2` |
| Arbitrum | `0xEf96021Af16BD04918b0d87cE045d7984ad6c38c` |
| Optimism | `0xad2184fb5dbcfc05d8f056542fb25b04fa32a95d` |

For other networks, check the [Manifold Royalty Registry documentation](https://docs.manifold.xyz/v/manifold-for-developers/smart-contracts/royalty-registry).

### Manifold Royalty System Addresses (Universal)

The following addresses are consistent across Base and all EVM chains:

| Contract | Address |
|----------|---------|
| TimeLock Controller | `0xe3A6CD067a1193b903143C36dA00557c9d95C41e` |
| Royalty Registry Impl | `0xd389340d95c851655dD99c5781be1c5e39d30B31` |
| Royalty Engine Impl | `0xD388d812c1cE2CE7C46D797684BA912De65CD414` |
| Royalty Override Factory | `0x103247393F448203ed7Ff7515E262316812637B4` |
| Royalty Fallback Registry | `0xB78fC2052717C7AE061a14dB1fB2038d5AC34D29` |

### sudoAMM v2 Production Deployments

The following are the official sudoAMM v2 deployments on Ethereum Mainnet:

**Core Contracts:**
- LSSVMPairFactory: `0xA020d57aB0448Ef74115c112D18a9C231CC86000`
- VeryFastRouter: `0x090C236B62317db226e6ae6CD4c0Fd25b7028b65`

**Bonding Curves:**
- LinearCurve: `0xe5d78fec1a7f42d2F3620238C498F088A866FdC5`
- ExponentialCurve: `0xfa056C602aD0C0C4EE4385b3233f2Cb06730334a`
- XYKCurve: `0xc7fB91B6cd3C67E02EC08013CEBb29b1241f3De5`
- GDACurve: `0x1fD5876d4A3860Eb0159055a3b7Cb79fdFFf6B67`

**Other:**
- SettingsFactory: `0xF4F439A6A152cFEcb1F34d726D490F82Bcb3c2C7`
- PropertyCheckerFactory: `0x031b216FaBec82310FEa3426b33455609b99AfC1`
- RoyaltyEngine: `0xBc40d21999b4BF120d330Ee3a2DE415287f626C9`

## Testing Deployments

After deployment, verify the contracts are working correctly:

### 1. Verify Contract Deployment

```bash
# Check factory owner
cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL

# Check protocol fee recipient
cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url $RPC_URL

# Check if a curve is whitelisted
cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL
```

### 2. Create a Test Pool

```bash
# You can use the factory to create a test pool
# See the main documentation for pool creation examples
```

## Troubleshooting

### Common Issues

**Issue**: "Insufficient funds for gas"
- **Solution**: Ensure your deployment account has enough native tokens

**Issue**: "Nonce too low"
- **Solution**: Wait for previous transactions to confirm, or manually set nonce

**Issue**: "Contract verification failed"
- **Solution**: Ensure ETHERSCAN_API_KEY is correct and wait a few minutes before retrying

**Issue**: "Factory owner mismatch"
- **Solution**: Ensure FACTORY_OWNER matches your deployment account if you want automatic configuration

## Advanced Usage

### Using a Hardware Wallet

```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --ledger \
  --sender $YOUR_ADDRESS \
  --broadcast
```

### Using a Mnemonic

```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --mnemonic-path .mnemonic \
  --broadcast
```

### Deploying to a Fork

```bash
# Start a local fork
anvil --fork-url $RPC_URL

# Deploy to the fork
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Security Considerations

1. **Private Key Security**: Never commit private keys or mnemonics to version control
2. **Verify Contracts**: Always verify contracts on block explorers after deployment
3. **Multi-sig Ownership**: Consider using a multi-sig wallet as the factory owner
4. **Test First**: Deploy to a testnet before mainnet
5. **Audit**: Ensure all contracts are audited before production deployment

## Support

For questions or issues:
- Documentation: https://docs.sudoswap.xyz/
- GitHub Issues: https://github.com/sudoswap/lssvm2/issues
- Discord: https://discord.gg/sudoswap

## License

All deployment scripts are licensed under AGPL-3.0, matching the protocol license.
