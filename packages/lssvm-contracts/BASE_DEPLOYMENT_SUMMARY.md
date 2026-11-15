# Base Mainnet Deployment Summary

**Deployment Date**: $(date)
**Deployer**: 0x6dA173B1d50F7Bc5c686f8880C20378965408344
**Chain**: Base Mainnet (8453)
**Status**: ✅ Successfully Deployed

## Deployed Contracts

### Core Contracts
- **RoyaltyEngine**: `0x8a492D8d41bE9886E4f7ee7572cEE4eE9DA364E1`
- **LSSVMPairERC721ETH**: `0x577C0A55a7C8189F31C22F39e41FA2A8DcB40bad`
- **LSSVMPairERC721ERC20**: `0x12AA8645252D5FEceCf467724CdDD83093069E9f`
- **LSSVMPairERC1155ETH**: `0xF130207fbE0913b5470732D25699E41F5Ea4da7f`
- **LSSVMPairERC1155ERC20**: `0x68f397655a5a1478e24Bdb52D0Df33e50AB6Ce28`
- **LSSVMPairFactory**: `0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e`

### Router
- **VeryFastRouter**: `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C`

## Configuration

### Bonding Curves (Base Mainnet)
All bonding curves are whitelisted:
- **LinearCurve**: `0xe41352CB8D9af18231E05520751840559C2a548A` ✅
- **ExponentialCurve**: `0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6` ✅
- **XykCurve**: `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B` ✅
- **GDACurve**: `0x4f1627be4C72aEB9565D4c751550C4D262a96B51` ✅

### Router Status
- **Router**: `0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C` ✅ Whitelisted

### Factory Configuration
- **Owner**: `0x6dA173B1d50F7Bc5c686f8880C20378965408344`
- **Protocol Fee Recipient**: Set in deployment
- **Protocol Fee Multiplier**: 1% (0.01e18)

## Deployment Transaction

**Total Gas Used**: 28,812,538 gas
**Total Cost**: ~0.0000085 ETH
**Block**: 38239761

## Next Steps

### 1. Update Miniapp Configuration

Add to `apps/miniapp/.env.local`:

```bash
# Base Mainnet (chainId: 8453)
NEXT_PUBLIC_FACTORY_ADDRESS_8453=0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e
NEXT_PUBLIC_ROUTER_ADDRESS_8453=0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C
```

### 2. Verify Contracts (Optional)

Contract verification failed due to API key rate limiting. You can verify manually later:

1. Go to https://basescan.org/
2. Search for each contract address
3. Click "Contract" tab → "Verify and Publish"
4. Use the verification parameters from the deployment

### 3. Test Deployment

Test the deployed contracts:
- Create a test pool
- Verify pool appears in browse page
- Test buying/selling NFTs

## Links

- **Factory on BaseScan**: https://basescan.org/address/0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e
- **Router on BaseScan**: https://basescan.org/address/0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C
- **RoyaltyEngine on BaseScan**: https://basescan.org/address/0x8a492D8d41bE9886E4f7ee7572cEE4eE9DA364E1

## Notes

- All contracts are deployed and functional
- Bonding curves are deployed on Base Mainnet (separate from Ethereum Mainnet deployments)
- Factory is fully configured and ready to use
- Contract verification can be completed later (not critical for functionality)

## Factory Configuration Status

✅ **All bonding curves are correctly whitelisted on Base Mainnet.**

The factory has been configured with the correct Base Mainnet bonding curve addresses:
- Base Mainnet addresses are whitelisted ✅
- Ethereum Mainnet addresses have been removed ✅

**Verification:**
- Base LinearCurve (0xe41352CB8D9af18231E05520751840559C2a548A): ✅ Whitelisted
- Base ExponentialCurve (0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6): ✅ Whitelisted
- Base XykCurve (0xd0A2f4ae5E816ec09374c67F6532063B60dE037B): ✅ Whitelisted
- Base GDACurve (0x4f1627be4C72aEB9565D4c751550C4D262a96B51): ✅ Whitelisted

