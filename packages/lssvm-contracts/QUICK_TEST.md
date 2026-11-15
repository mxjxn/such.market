# Quick Testing Guide

## Option 1: Run Unit Tests (No Deployment Needed)

The fastest way to test - runs all unit tests without deploying:

```bash
cd packages/lssvm-contracts
forge test
```

This tests:
- All bonding curves (Linear, Exponential, XYK, GDA)
- Router functionality
- Pair creation and trading
- Royalty handling
- Property checking
- Settings

**Verbose output:**
```bash
forge test -vvv  # More detailed output
```

**Run specific tests:**
```bash
forge test --match-path "**/LinearCurve.t.sol"
forge test --match-path "**/Router*.t.sol"
```

## Option 2: Deploy Locally and Test

### Step 1: Start Anvil

```bash
# Terminal 1
anvil
```

This will show you:
- Available accounts (first one: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)
- Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- RPC URL: `http://127.0.0.1:8545`

### Step 2: Create `.env.local`

```bash
cd packages/lssvm-contracts
cat > .env.local << EOF
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ROYALTY_REGISTRY=0x0000000000000000000000000000000000000000
PROTOCOL_FEE_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
PROTOCOL_FEE_MULTIPLIER=10000000000000000
FACTORY_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
EOF
```

### Step 3: Deploy Contracts

```bash
# Terminal 2
cd packages/lssvm-contracts
./deploy-local.sh
```

This will deploy all contracts and automatically configure the factory.

### Step 4: Run Integration Tests

```bash
./test-integration.sh
```

This verifies:
- Factory owner is set correctly
- Bonding curves are whitelisted
- Router is whitelisted
- Protocol fees are configured
- RoyaltyEngine is connected

### Step 5: Manual Testing

See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for detailed examples of:
- Creating ERC721 pools
- Creating ERC1155 pools
- Buying NFTs
- Selling NFTs
- Using the router for multi-pool swaps

## Quick Test Checklist

- [ ] `forge test` passes (unit tests)
- [ ] `./deploy-local.sh` succeeds (deployment)
- [ ] `./test-integration.sh` passes (integration tests)
- [ ] Can create a test pool (manual testing)
- [ ] Can buy/sell NFTs (manual testing)

## Troubleshooting

**Tests fail to compile:**
```bash
forge build
```

**Anvil not running:**
```bash
# Check if Anvil is running
curl http://127.0.0.1:8545
# Should return JSON, not error
```

**Deployment fails:**
- Make sure Anvil is running in another terminal
- Check `.env.local` file exists and has correct values
- Verify private key matches Anvil account

**Integration tests show empty responses:**
- Contracts may not have deployed successfully
- Check the broadcast file: `broadcast/DeployAll.s.sol/31337/run-latest.json`
- Redeploy if needed

## Next Steps

1. **Start with unit tests**: `forge test` - fastest way to verify everything works
2. **Then deploy locally**: `./deploy-local.sh` - test actual deployment
3. **Run integration tests**: `./test-integration.sh` - verify deployment
4. **Manual testing**: Follow LOCAL_TESTING.md for pool creation and trading

For more details, see [TESTING.md](./TESTING.md).

