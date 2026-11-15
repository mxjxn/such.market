# Testing Guide for sudoAMM v2

This guide covers different ways to test the sudoAMM v2 protocol, from unit tests to integration tests with deployed contracts.

## Table of Contents

- [Unit Tests](#unit-tests)
- [Integration Tests with Deployed Contracts](#integration-tests-with-deployed-contracts)
- [Manual Testing with Cast](#manual-testing-with-cast)
- [Full Test Suite](#full-test-suite)

## Unit Tests

The project includes a comprehensive test suite that deploys contracts fresh for each test. Run all tests:

```bash
cd packages/lssvm-contracts
forge test
```

Run with verbose output:

```bash
forge test -vvv
```

Run specific test files:

```bash
forge test --match-path "**/LinearCurve.t.sol"
forge test --match-path "**/Router*.t.sol"
```

### Test Coverage

Generate coverage report:

```bash
forge coverage --report lcov
genhtml lcov.info -o report --branch
open report/index.html
```

## Integration Tests with Deployed Contracts

After deploying contracts locally (see [LOCAL_TESTING.md](./LOCAL_TESTING.md)), you can run integration tests against the deployed contracts.

### Prerequisites

1. **Anvil running** (accounts are automatically unlocked by default):
   ```bash
   anvil
   ```

2. **Contracts deployed** using `./deploy-local.sh`

### Running Integration Tests

```bash
./test-integration.sh
```

This script verifies:
- Factory owner is set correctly
- Bonding curves are whitelisted
- Router is whitelisted
- Protocol fee configuration
- RoyaltyEngine is connected

### Note on Wallet Access

Anvil automatically unlocks all accounts by default. The `deploy-local.sh` script uses `--private-key` to sign transactions. If you see errors like "No associated wallet", ensure:

1. Anvil is running: `anvil`
2. The `PRIVATE_KEY` in `.env.local` matches an Anvil account
3. The script includes `--private-key` flag (which `deploy-local.sh` does automatically)

## Manual Testing with Cast

After deployment, you can manually test contracts using `cast` commands. See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for detailed examples.

### Quick Verification

```bash
# Set addresses from deployment output
FACTORY=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
LINEAR_CURVE=0x0165878A594ca255338adfa4d48449f69242Eb8F

# Check factory owner
cast call $FACTORY "owner()" --rpc-url http://127.0.0.1:8545

# Check if curve is whitelisted
cast call $FACTORY "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url http://127.0.0.1:8545
# Should return: 0x0000000000000000000000000000000000000000000000000000000000000001 (true)
```

## Full Test Suite

The test suite includes:

### Bonding Curve Tests
- `LinearCurve.t.sol` - Linear bonding curve tests
- `ExponentialCurve.t.sol` - Exponential curve tests
- `XykCurve.t.sol` - XYK curve tests
- `GDACurve.t.sol` - GDA curve tests

### Router Tests
- `RouterSinglePool.t.sol` - Single pool swaps
- `RouterMultiPool.t.sol` - Multi-pool swaps
- `RouterRobustSwap.t.sol` - Robust swap tests
- `VeryFastRouterAllSwapTypes.t.sol` - All swap type tests

### Pair Tests
- `PairAndFactory.t.sol` - Base pair functionality
- Various mixins for different configurations

### Property Checking Tests
- `PropertyChecking.t.sol` - Property checker functionality

### Settings Tests
- `SettingsE2E.t.sol` - End-to-end settings tests

### Royalty Tests
- `RoyaltyEngine.t.sol` - Royalty engine tests
- Router tests with royalties

## Testing Against Forked Networks

You can also test against forked networks for more realistic scenarios:

```bash
# Fork Base Sepolia
anvil --fork-url https://sepolia.base.org

# Run tests against fork
forge test --fork-url http://127.0.0.1:8545
```

## Troubleshooting

### Tests Fail with "insufficient funds"
- Ensure test accounts have enough ETH
- In Anvil, accounts start with 10000 ETH by default

### Tests Fail with "contract not found"
- Make sure contracts are compiled: `forge build`
- Check that remappings are correct in `foundry.toml`

### Integration tests fail with empty responses
- Verify Anvil is running: `curl http://127.0.0.1:8545`
- Check that contracts were actually deployed (check broadcast file)
- Ensure accounts are unlocked in Anvil if using `--broadcast`

### Deployment script runs but transactions don't broadcast
- Ensure `--private-key` is included in the forge script command
- The `deploy-local.sh` script automatically adds this
- Check that `--broadcast` flag is included
- Verify Anvil is running and accessible

## Next Steps

1. **Run unit tests**: `forge test` to verify all functionality
2. **Deploy locally**: Use `./deploy-local.sh` to deploy to Anvil
3. **Run integration tests**: `./test-integration.sh` to verify deployment
4. **Manual testing**: Use cast commands to test pool creation and trading
5. **See LOCAL_TESTING.md**: For detailed pool testing workflows

