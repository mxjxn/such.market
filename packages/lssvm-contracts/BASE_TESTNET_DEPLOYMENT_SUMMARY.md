# Base Sepolia Testnet Deployment Summary

**Deployment Date**: December 2024
**Deployer**: 0x6dA173B1d50F7Bc5c686f8880C20378965408344
**Chain**: Base Sepolia Testnet (84532)
**Status**: ✅ Successfully Deployed

## Deployed Contracts

### Bonding Curves
- **LinearCurve**: `0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0`
- **ExponentialCurve**: `0x4637d06530d5D375B1D5dE1117C98b0c6EA7eDd1`
- **XykCurve**: `0xC4DfB54Ca18c9e5EC2a23e8DE09588982A6b2242`
- **GDACurve**: `0x60bAB2734eb85F07Ca93E3B7Fb1015fcc5e9CbA7`

### Core Contracts
- **RoyaltyEngine**: `0xc51303BfE0a4d268137a0910073f907dCB8Bc51f`
- **LSSVMPairERC721ETH**: `0x723124567064B038e6fA2C247E8815B06443C43a`
- **LSSVMPairERC721ERC20**: `0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef`
- **LSSVMPairERC1155ETH**: `0x065Ab76c7e9Edcfb3bF25B9076235e7A5ffA76f4`
- **LSSVMPairERC1155ERC20**: `0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9`
- **LSSVMPairFactory**: `0x372990Fd91CF61967325dD5270f50c4192bfb892`

### Router
- **VeryFastRouter**: `0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3`

## Configuration

### Bonding Curves Status
All bonding curves are whitelisted:
- **LinearCurve**: `0x3F1E31d662eD24b6B69d73B07C98076d3814F8C0` ✅
- **ExponentialCurve**: `0x4637d06530d5D375B1D5dE1117C98b0c6EA7eDd1` ✅
- **XykCurve**: `0xC4DfB54Ca18c9e5EC2a23e8DE09588982A6b2242` ✅
- **GDACurve**: `0x60bAB2734eb85F07Ca93E3B7Fb1015fcc5e9CbA7` ✅

### Router Status
- **Router**: `0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3` ✅ (Whitelisted)

### Factory Owner
- **Owner**: `0x6dA173B1d50F7Bc5c686f8880C20378965408344` ✅ (Matches Deployer)

### Protocol Fees
- **Recipient**: Configured via environment variable ✅
- **Multiplier**: Configured via environment variable ✅

## Deployment Details

### Gas Usage
- **Total Gas Used**: 31,155,320 gas
- **Total Cost**: ~0.000031 ETH (testnet)
- **Average Gas Price**: 0.001000062 gwei

### Transaction Hashes
All transactions were successfully broadcast to Base Sepolia testnet. Key transactions:

- Factory deployment: `0xc2cfa6bb8b9d0d4cfdefcb1a9294141f0c33f32a3fb0616c07e0513e38cffab3`
- Router deployment: `0x801a68bb07db736193f4bfa57c4875a8ce79c756b96628405a62baa1a60c3717`
- Bonding curve whitelisting: Multiple transactions (see full deployment logs)

## Verification Status
- **BaseScan Sepolia Verification**: ❌ Failed due to "Too many invalid api key attempts, please try again later"
  - *Note*: Contracts are deployed and functional. Verification can be performed manually later.

## BaseScan Links

- **Factory on BaseScan Sepolia**: https://sepolia.basescan.org/address/0x372990Fd91CF61967325dD5270f50c4192bfb892
- **Router on BaseScan Sepolia**: https://sepolia.basescan.org/address/0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3
- **RoyaltyEngine on BaseScan Sepolia**: https://sepolia.basescan.org/address/0xc51303BfE0a4d268137a0910073f907dCB8Bc51f

## Notes

- All contracts are deployed and functional on Base Sepolia testnet
- Bonding curves were deployed fresh (not reused from mainnet)
- Factory is fully configured and ready to use
- Contract verification can be completed later (not critical for functionality)
- This is a testnet deployment - use testnet ETH only

## Test NFT Contracts

Test NFT contracts have been deployed for testing pools:

- **TestNFT721**: [`0xF130207fbE0913b5470732D25699E41F5Ea4da7f`](https://sepolia.basescan.org/address/0xF130207fbE0913b5470732D25699E41F5Ea4da7f)
  - 100 tokens pre-minted (IDs 0-99)
  
- **TestNFT1155**: [`0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28`](https://sepolia.basescan.org/address/0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28)
  - Item 0 (ID 0): 10 copies
  - Item 1 (ID 1): 1000 copies

For detailed information on using these test NFTs, see [TEST_NFTS.md](./TEST_NFTS.md).

## Next Steps

1. **Update Miniapp Configuration**:
   Edit `apps/miniapp/.env.local` with the following:
   ```
   NEXT_PUBLIC_FACTORY_ADDRESS_84532=0x372990Fd91CF61967325dD5270f50c4192bfb892
   NEXT_PUBLIC_ROUTER_ADDRESS_84532=0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3
   ```
   Restart your Next.js dev server after updating for changes to take effect.

2. **Test the Deployment**:
   - Create a test pool using the deployed factory and test NFTs
   - Use TestNFT721 for ERC721/ETH pools
   - Use TestNFT1155 for ERC1155/ETH pools
   - Verify the pool appears in the miniapp
   - Test buying and selling NFTs on testnet

3. **Manual Contract Verification (Optional)**:
   If desired, manually verify the deployed contracts on [BaseScan Sepolia](https://sepolia.basescan.org/).

4. **Get Testnet ETH**:
   If you need more testnet ETH for testing:
   - Coinbase Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
   - Base Bridge: https://bridge.base.org/deposit

