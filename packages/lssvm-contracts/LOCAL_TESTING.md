# Local Testing Guide for sudoAMM v2

This guide walks you through testing the sudoAMM v2 protocol locally using Anvil (Foundry's local Ethereum node).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Factory Configuration](#factory-configuration)
- [Testing ERC721 Pools](#testing-erc721-pools)
- [Testing ERC1155 Pools](#testing-erc1155-pools)
- [Useful Cast Commands](#useful-cast-commands)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **Foundry installed**: Make sure you have Foundry installed (`forge --version`)
2. **Anvil running**: Start a local Anvil node in a separate terminal:
   ```bash
   anvil
   ```
   This will output:
   - Available accounts with private keys
   - RPC URL: `http://127.0.0.1:8545`

3. **Environment variables**: Create `.env.local` in `packages/lssvm-contracts/`:
   ```bash
   RPC_URL=http://127.0.0.1:8545
   PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ROYALTY_REGISTRY=0x0000000000000000000000000000000000000000
   PROTOCOL_FEE_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   PROTOCOL_FEE_MULTIPLIER=10000000000000000
   FACTORY_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   ```

   **Note**: Use the first Anvil account's address and private key (shown when you start Anvil).

## Deployment

### Quick Deployment

Use the helper script:

```bash
cd packages/lssvm-contracts
./deploy-local.sh
```

### Manual Deployment

```bash
cd packages/lssvm-contracts
source .env.local

forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --skip test \
  --broadcast \
  --sender $(cast wallet address $PRIVATE_KEY) \
  -vvvv
```

### Verifying Deployment Success

After deployment, you should see a summary with all contract addresses. Save these addresses for testing:

- **LSSVMPairFactory**: Main factory contract
- **VeryFastRouter**: Router for multi-pool swaps
- **Bonding Curves**: LinearCurve, ExponentialCurve, XykCurve, GDACurve
- **RoyaltyEngine**: Handles royalty lookups

Verify the factory was deployed:

```bash
# Replace FACTORY_ADDRESS with the actual address from deployment
FACTORY_ADDRESS=0xBb2180ebd78ce97360503434eD37fcf4a1Df61c3

cast call $FACTORY_ADDRESS "owner()" --rpc-url http://127.0.0.1:8545
```

## Factory Configuration

The deployment script should automatically configure the factory (whitelist bonding curves and router) if the deployer is the factory owner. If auto-configuration was skipped, configure manually:

### Manual Configuration

Replace addresses with your deployed addresses:

```bash
# Set your deployed addresses
FACTORY_ADDRESS=0xBb2180ebd78ce97360503434eD37fcf4a1Df61c3
LINEAR_CURVE=0xDB8cFf278adCCF9E9b5da745B44E754fC4EE3C76
EXPONENTIAL_CURVE=0x50EEf481cae4250d252Ae577A09bF514f224C6C4
XYK_CURVE=0x62c20Aa1e0272312BC100b4e23B4DC1Ed96dD7D1
GDA_CURVE=0xDEb1E9a6Be7Baf84208BB6E10aC9F9bbE1D70809
ROUTER_ADDRESS=0xD718d5A27a29FF1cD22403426084bA0d479869a0
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Whitelist bonding curves
cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $LINEAR_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $EXPONENTIAL_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $XYK_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  $GDA_CURVE true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Whitelist router
cast send $FACTORY_ADDRESS \
  "setRouterAllowed(address,bool)" \
  $ROUTER_ADDRESS true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Verify Configuration

```bash
# Check if bonding curve is whitelisted (should return 0x0000...0001 for true)
cast call $FACTORY_ADDRESS \
  "bondingCurveAllowed(address)" \
  $LINEAR_CURVE \
  --rpc-url http://127.0.0.1:8545

# Check if router is whitelisted
cast call $FACTORY_ADDRESS \
  "routerAllowed(address)" \
  $ROUTER_ADDRESS \
  --rpc-url http://127.0.0.1:8545
```

## Testing ERC721 Pools

### Step 1: Deploy Test ERC721 Token

First, deploy a test ERC721 token. You can use the mock contract:

```bash
# Compile the mock contract
forge build --skip test

# Deploy Test721
cast send --create \
  "$(cat out/src/mocks/Test721.sol/Test721.json | jq -r '.bytecode.object')" \
  --constructor-args \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Or use forge create for easier deployment
forge create src/mocks/Test721.sol:Test721 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

Save the deployed token address as `NFT_ADDRESS`.

### Step 2: Mint Test NFTs

```bash
NFT_ADDRESS=<your_nft_address>
USER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Mint NFT with ID 1
cast send $NFT_ADDRESS \
  "mint(address,uint256)" \
  $USER_ADDRESS 1 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Mint NFT with ID 2
cast send $NFT_ADDRESS \
  "mint(address,uint256)" \
  $USER_ADDRESS 2 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 3: Create ERC721/ETH Pool

Create a pool using the factory. For a TOKEN pool (pool holds NFTs, users buy with ETH):

```bash
FACTORY_ADDRESS=0xBb2180ebd78ce97360503434eD37fcf4a1Df61c3
NFT_ADDRESS=<your_nft_address>
LINEAR_CURVE=0xDB8cFf278adCCF9E9b5da745B44E754fC4EE3C76
SPOT_PRICE=1000000000000000000  # 1 ETH in wei
DELTA=100000000000000000  # 0.1 ETH delta for linear curve
POOL_TYPE=0  # 0 = TOKEN pool

# Create pool with initial NFTs [1, 2]
cast send $FACTORY_ADDRESS \
  "createPairERC721ETH(address,address,address,uint8,uint128,uint96,uint128,address,uint256[])" \
  $NFT_ADDRESS \
  $LINEAR_CURVE \
  0x0000000000000000000000000000000000000000 \
  $POOL_TYPE \
  $DELTA \
  0 \
  $SPOT_PRICE \
  0x0000000000000000000000000000000000000000 \
  "[1,2]" \
  --value $(cast --to-wei 0.1 ether) \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

**Note**: You need to approve the factory to transfer your NFTs first:

```bash
# Approve factory to transfer NFTs
cast send $NFT_ADDRESS \
  "approve(address,uint256)" \
  $FACTORY_ADDRESS 1 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

cast send $NFT_ADDRESS \
  "approve(address,uint256)" \
  $FACTORY_ADDRESS 2 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

Save the pool address from the transaction receipt.

### Step 4: Buy NFT from Pool

```bash
POOL_ADDRESS=<pool_address>
NFT_ID=1

# Get quote for buying NFT ID 1
cast call $POOL_ADDRESS \
  "getBuyNFTQuote(uint256)" \
  $NFT_ID \
  --rpc-url http://127.0.0.1:8545

# Buy NFT (replace with actual quote amount)
cast send $POOL_ADDRESS \
  "swapTokenForSpecificNFTs(uint256[],uint256,address,bool)" \
  "[$NFT_ID]" \
  <quote_amount> \
  0x0000000000000000000000000000000000000000 \
  false \
  --value <quote_amount> \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 5: Sell NFT to Pool

```bash
POOL_ADDRESS=<pool_address>
NFT_ADDRESS=<nft_address>
NFT_ID=1

# Approve pool to transfer NFT
cast send $NFT_ADDRESS \
  "approve(address,uint256)" \
  $POOL_ADDRESS $NFT_ID \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Get quote for selling NFT
cast call $POOL_ADDRESS \
  "getSellNFTQuote(uint256)" \
  $NFT_ID \
  --rpc-url http://127.0.0.1:8545

# Sell NFT
cast send $POOL_ADDRESS \
  "swapNFTsForToken(uint256[],uint256,address,bool)" \
  "[$NFT_ID]" \
  <min_output> \
  0x0000000000000000000000000000000000000000 \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 6: Verify Pool State

```bash
POOL_ADDRESS=<pool_address>

# Check pool's NFT balance
cast call $POOL_ADDRESS \
  "nft()" \
  --rpc-url http://127.0.0.1:8545

# Check spot price
cast call $POOL_ADDRESS \
  "spotPrice()" \
  --rpc-url http://127.0.0.1:8545

# Check pool type
cast call $POOL_ADDRESS \
  "poolType()" \
  --rpc-url http://127.0.0.1:8545
```

## Testing ERC1155 Pools

### Step 1: Deploy Test ERC1155 Token

```bash
# Deploy Test1155
forge create src/mocks/Test1155.sol:Test1155 \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

Save the deployed token address as `NFT1155_ADDRESS`.

### Step 2: Mint Test ERC1155 Tokens

```bash
NFT1155_ADDRESS=<your_erc1155_address>
USER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TOKEN_ID=1
AMOUNT=100

# Mint 100 tokens with ID 1
cast send $NFT1155_ADDRESS \
  "mint(address,uint256,uint256)" \
  $USER_ADDRESS $TOKEN_ID $AMOUNT \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 3: Create ERC1155/ETH Pool

```bash
FACTORY_ADDRESS=0xBb2180ebd78ce97360503434eD37fcf4a1Df61c3
NFT1155_ADDRESS=<your_erc1155_address>
LINEAR_CURVE=0xDB8cFf278adCCF9E9b5da745B44E754fC4EE3C76
SPOT_PRICE=1000000000000000000  # 1 ETH per NFT
DELTA=100000000000000000  # 0.1 ETH delta
POOL_TYPE=0  # 0 = TOKEN pool
TOKEN_ID=1
INITIAL_BALANCE=10  # Start with 10 NFTs in pool

# Approve factory to transfer NFTs
cast send $NFT1155_ADDRESS \
  "setApprovalForAll(address,bool)" \
  $FACTORY_ADDRESS true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Create pool
cast send $FACTORY_ADDRESS \
  "createPairERC1155ETH(address,address,address,uint8,uint128,uint96,uint128,uint256,uint256)" \
  $NFT1155_ADDRESS \
  $LINEAR_CURVE \
  0x0000000000000000000000000000000000000000 \
  $POOL_TYPE \
  $DELTA \
  0 \
  $SPOT_PRICE \
  $TOKEN_ID \
  $INITIAL_BALANCE \
  --value $(cast --to-wei 0.1 ether) \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

Save the pool address from the transaction receipt.

### Step 4: Buy ERC1155 Tokens from Pool

```bash
POOL_ADDRESS=<pool_address>
TOKEN_ID=1
AMOUNT=5  # Buy 5 tokens

# Get quote
cast call $POOL_ADDRESS \
  "getBuyQuote(uint256,uint256)" \
  $AMOUNT $TOKEN_ID \
  --rpc-url http://127.0.0.1:8545

# Buy tokens (replace with actual quote)
cast send $POOL_ADDRESS \
  "swapTokenForSpecificNFTs(uint256[],uint256,address,bool)" \
  "[$TOKEN_ID]" \
  <quote_amount> \
  0x0000000000000000000000000000000000000000 \
  false \
  --value <quote_amount> \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 5: Sell ERC1155 Tokens to Pool

```bash
POOL_ADDRESS=<pool_address>
NFT1155_ADDRESS=<nft_address>
TOKEN_ID=1
AMOUNT=3  # Sell 3 tokens

# Approve pool
cast send $NFT1155_ADDRESS \
  "setApprovalForAll(address,bool)" \
  $POOL_ADDRESS true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545

# Get sell quote
cast call $POOL_ADDRESS \
  "getSellQuote(uint256,uint256)" \
  $AMOUNT $TOKEN_ID \
  --rpc-url http://127.0.0.1:8545

# Sell tokens
cast send $POOL_ADDRESS \
  "swapNFTsForToken(uint256[],uint256,address,bool)" \
  "[$TOKEN_ID]" \
  <min_output> \
  0x0000000000000000000000000000000000000000 \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

### Step 6: Verify Pool State

```bash
POOL_ADDRESS=<pool_address>

# Check NFT contract address
cast call $POOL_ADDRESS \
  "nft()" \
  --rpc-url http://127.0.0.1:8545

# Check NFT ID being traded
cast call $POOL_ADDRESS \
  "nftId()" \
  --rpc-url http://127.0.0.1:8545

# Check current NFT balance in pool
cast call $POOL_ADDRESS \
  "nftBalance()" \
  --rpc-url http://127.0.0.1:8545

# Check spot price
cast call $POOL_ADDRESS \
  "spotPrice()" \
  --rpc-url http://127.0.0.1:8545
```

## Useful Cast Commands

### Factory Queries

```bash
FACTORY_ADDRESS=0xBb2180ebd78ce97360503434eD37fcf4a1Df61c3

# Get factory owner
cast call $FACTORY_ADDRESS "owner()" --rpc-url http://127.0.0.1:8545

# Check protocol fee recipient
cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url http://127.0.0.1:8545

# Check protocol fee multiplier
cast call $FACTORY_ADDRESS "protocolFeeMultiplier()" --rpc-url http://127.0.0.1:8545

# Check if bonding curve is whitelisted
cast call $FACTORY_ADDRESS \
  "bondingCurveAllowed(address)" \
  <curve_address> \
  --rpc-url http://127.0.0.1:8545

# Check if router is whitelisted
cast call $FACTORY_ADDRESS \
  "routerAllowed(address)" \
  <router_address> \
  --rpc-url http://127.0.0.1:8545
```

### Pool Queries

```bash
POOL_ADDRESS=<pool_address>

# Get pool type (0=TOKEN, 1=NFT, 2=TRADE)
cast call $POOL_ADDRESS "poolType()" --rpc-url http://127.0.0.1:8545

# Get spot price
cast call $POOL_ADDRESS "spotPrice()" --rpc-url http://127.0.0.1:8545

# Get delta
cast call $POOL_ADDRESS "delta()" --rpc-url http://127.0.0.1:8545

# Get fee
cast call $POOL_ADDRESS "fee()" --rpc-url http://127.0.0.1:8545

# Get NFT contract
cast call $POOL_ADDRESS "nft()" --rpc-url http://127.0.0.1:8545

# Get bonding curve
cast call $POOL_ADDRESS "bondingCurve()" --rpc-url http://127.0.0.1:8545

# Get pool owner
cast call $POOL_ADDRESS "owner()" --rpc-url http://127.0.0.1:8545
```

### Balance Checks

```bash
# Check ETH balance
cast balance <address> --rpc-url http://127.0.0.1:8545

# Check ERC721 ownership
cast call <nft_address> \
  "ownerOf(uint256)" \
  <token_id> \
  --rpc-url http://127.0.0.1:8545

# Check ERC1155 balance
cast call <nft1155_address> \
  "balanceOf(address,uint256)" \
  <owner_address> <token_id> \
  --rpc-url http://127.0.0.1:8545
```

## Troubleshooting

### Common Issues

#### 1. "Bonding curve not whitelisted" error

**Solution**: Make sure you've whitelisted the bonding curve in the factory:
```bash
cast send $FACTORY_ADDRESS \
  "setBondingCurveAllowed(address,bool)" \
  <curve_address> true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

#### 2. "Router not whitelisted" error

**Solution**: Whitelist the router:
```bash
cast send $FACTORY_ADDRESS \
  "setRouterAllowed(address,bool)" \
  <router_address> true \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545
```

#### 3. "Insufficient funds" error

**Solution**: Anvil accounts start with 10,000 ETH. If you need more:
```bash
# In Anvil terminal, use the anvil_setBalance RPC method
cast rpc anvil_setBalance <address> 0x56bc75e2d6300000000 --rpc-url http://127.0.0.1:8545
```

#### 4. "Nonce too low" error

**Solution**: Wait for previous transactions to confirm, or reset Anvil:
```bash
# Restart Anvil to reset nonces
# In Anvil terminal: Ctrl+C, then run `anvil` again
```

#### 5. Transaction reverts with unclear error

**Solution**: Use `-vvvv` flag for detailed traces:
```bash
cast send <address> <function> <args> \
  --private-key $PRIVATE_KEY \
  --rpc-url http://127.0.0.1:8545 \
  -vvvv
```

### Resetting Anvil State

To start fresh:

1. Stop Anvil (Ctrl+C in Anvil terminal)
2. Restart Anvil: `anvil`
3. Redeploy contracts using `./deploy-local.sh`

### Debugging Failed Transactions

1. **Check transaction receipt**:
   ```bash
   cast tx <tx_hash> --rpc-url http://127.0.0.1:8545
   ```

2. **Simulate transaction first**:
   ```bash
   cast send <address> <function> <args> \
     --private-key $PRIVATE_KEY \
     --rpc-url http://127.0.0.1:8545 \
     --dry-run
   ```

3. **Use Foundry's trace**:
   ```bash
   cast run <tx_hash> --rpc-url http://127.0.0.1:8545 -vvvv
   ```

### Getting Help

- Check the main [README.md](./script/README.md) for deployment details
- Review contract source code in `src/`
- Check test files in `src/test/` for usage examples

