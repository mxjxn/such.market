# Test NFT Contracts

Test NFT contracts for testing LSSVM pools on Base Sepolia testnet.

## Deployed Contracts

### Base Sepolia Testnet

**ERC721 Test Contract**
- **Contract**: TestNFT721
- **Address**: [`0xF130207fbE0913b5470732D25699E41F5Ea4da7f`](https://sepolia.basescan.org/address/0xF130207fbE0913b5470732D25699E41F5Ea4da7f)
- **Total Supply**: 100 tokens (IDs 0-99)
- **Pre-minted**: All 100 tokens are minted to deployer on deployment
- **Owner**: `0x6dA173B1d50F7Bc5c686f8880C20378965408344`

**ERC1155 Test Contract**
- **Contract**: TestNFT1155
- **Address**: [`0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28`](https://sepolia.basescan.org/address/0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28)
- **Item 0 (ID 0)**: 10 copies
- **Item 1 (ID 1)**: 1000 copies
- **Pre-minted**: All items are minted to deployer on deployment
- **Owner**: `0x6dA173B1d50F7Bc5c686f8880C20378965408344`

## Contract Details

### TestNFT721

A simple ERC721 contract that automatically mints 100 tokens (IDs 0-99) to the deployer upon deployment.

**Features:**
- Standard ERC721 implementation
- Ownable (deployer is owner)
- Additional minting functions for owner
- Batch minting support

**Usage:**
```solidity
// All tokens 0-99 are already minted to deployer
TestNFT721 nft = TestNFT721(0xF130207fbE0913b5470732D25699E41F5Ea4da7f);

// Check balance
uint256 balance = nft.balanceOf(deployer); // Returns 100

// Check owner of token 0
address owner = nft.ownerOf(0); // Returns deployer address
```

### TestNFT1155

A simple ERC1155 contract that automatically mints:
- 10 copies of item 0 (ID 0)
- 1000 copies of item 1 (ID 1)

All items are minted to the deployer upon deployment.

**Features:**
- Standard ERC1155 implementation
- Ownable (deployer is owner)
- Additional minting functions for owner
- Batch minting support

**Usage:**
```solidity
// All items are already minted to deployer
TestNFT1155 nft = TestNFT1155(0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28);

// Check balance of item 0
uint256 balance0 = nft.balanceOf(deployer, 0); // Returns 10

// Check balance of item 1
uint256 balance1 = nft.balanceOf(deployer, 1); // Returns 1000
```

## Deployment

### Deploy Locally (Anvil)

```bash
# Start Anvil
anvil

# Deploy test NFTs
cd packages/lssvm-contracts
./deploy-test-nfts.sh
```

### Deploy to Base Sepolia Testnet

```bash
# Set RPC_URL in .env.local to Base Sepolia
# RPC_URL=https://sepolia.base.org
# Or use Alchemy: RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Deploy
cd packages/lssvm-contracts
./deploy-test-nfts.sh
```

### Manual Deployment

```bash
forge script script/DeployTestNFTs.s.sol:DeployTestNFTs \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Testing Pools

### Create ERC721/ETH Pool

```bash
FACTORY_ADDRESS=0x372990Fd91CF61967325dD5270f50c4192bfb892
NFT_ADDRESS=0xF130207fbE0913b5470732D25699E41F5Ea4da7f
LINEAR_CURVE=0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0
SPOT_PRICE=1000000000000000000  # 1 ETH
DELTA=100000000000000000  # 0.1 ETH

# Create pool with initial NFTs [0, 1, 2]
cast send $FACTORY_ADDRESS \
  "createPairERC721ETH(address,address,address,uint8,uint128,uint96,uint128,address,uint256[])" \
  $NFT_ADDRESS \
  $LINEAR_CURVE \
  0x0000000000000000000000000000000000000000 \
  0 \
  $SPOT_PRICE \
  0 \
  $DELTA \
  0x0000000000000000000000000000000000000000 \
  "[0,1,2]" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

### Create ERC1155/ETH Pool

```bash
FACTORY_ADDRESS=0x372990Fd91CF61967325dD5270f50c4192bfb892
NFT_ADDRESS=0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28
LINEAR_CURVE=0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0
SPOT_PRICE=1000000000000000000  # 1 ETH
DELTA=100000000000000000  # 0.1 ETH
ITEM_ID=0  # Use item 0 (10 copies available)

# Create pool with initial supply of 5 copies of item 0
cast send $FACTORY_ADDRESS \
  "createPairERC1155ETH(address,address,address,uint8,uint128,uint96,uint128,uint256,uint256)" \
  $NFT_ADDRESS \
  $LINEAR_CURVE \
  0x0000000000000000000000000000000000000000 \
  0 \
  $SPOT_PRICE \
  0 \
  $DELTA \
  $ITEM_ID \
  5 \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

## Transferring Tokens

### Transfer ERC721 Tokens

```bash
NFT_ADDRESS=0xF130207fbE0913b5470732D25699E41F5Ea4da7f
TOKEN_ID=0
RECIPIENT=0x...

cast send $NFT_ADDRESS \
  "transferFrom(address,address,uint256)" \
  $DEPLOYER_ADDRESS \
  $RECIPIENT \
  $TOKEN_ID \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

### Transfer ERC1155 Tokens

```bash
NFT_ADDRESS=0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28
ITEM_ID=0
AMOUNT=5
RECIPIENT=0x...

cast send $NFT_ADDRESS \
  "safeTransferFrom(address,address,uint256,uint256,bytes)" \
  $DEPLOYER_ADDRESS \
  $RECIPIENT \
  $ITEM_ID \
  $AMOUNT \
  "0x" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

## Verification Status

- **BaseScan Sepolia Verification**: ❌ Failed due to API key rate limiting
  - Contracts are deployed and functional
  - Verification can be performed manually later if needed

## Notes

- These contracts are for testing purposes only
- All tokens/items are pre-minted to the deployer
- The deployer can mint additional tokens/items using the owner functions
- Contracts use standard OpenZeppelin implementations for security

