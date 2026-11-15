# LSSVM Contracts

This package contains the Solidity contracts for the LSSVM (sudoAMM v2) protocol.

## Structure

- **`src/`** - Main Solidity contract source files
  - `bonding-curves/` - Price curve implementations
  - `erc721/` - ERC721 pair implementations
  - `erc1155/` - ERC1155 pair implementations
  - `property-checking/` - Property checker contracts
  - `royalty-auth/` - Royalty interface implementations
  - `settings/` - Settings contract implementations
  - `test/` - Test files
- **`script/`** - Deployment scripts
- **`lib/`** - Foundry dependencies

## Building

```bash
forge build
```

## Testing

### Unit Tests

Run the full test suite:

```bash
forge test
```

For coverage:
```bash
forge coverage --report lcov
genhtml lcov.info -o report --branch
open report/index.html
```

### Integration Tests

After deploying contracts locally, test them with:

```bash
./test-integration.sh
```

For comprehensive testing documentation, see [TESTING.md](./TESTING.md).

## Deployment

See the [deployment guide](./script/README.md) for detailed instructions.

### Local Testing

Before deploying to testnet or mainnet, test deployments locally using Anvil:

```bash
# Start Anvil in one terminal
anvil

# Deploy to local node
./deploy-local.sh
```

For comprehensive local testing instructions including ERC721 and ERC1155 pool testing, see [LOCAL_TESTING.md](./LOCAL_TESTING.md).

### Base Testnet Deployment

Deploy to Base Sepolia testnet:

```bash
# Set up .env.local with testnet configuration
# Then deploy:
./deploy-base-testnet.sh
```

See [DEPLOY_BASE_TESTNET.md](./DEPLOY_BASE_TESTNET.md) for detailed testnet deployment instructions.

### Base Mainnet Deployment

Deploy to Base mainnet:

```bash
# Set up .env.local with mainnet configuration
# Then deploy:
./deploy-base.sh
```

See [DEPLOY_BASE.md](./DEPLOY_BASE.md) for detailed mainnet deployment instructions.

### Test NFT Contracts

Deploy test NFT contracts for testing pools:

```bash
# Deploy test NFTs (ERC721 with 100 tokens, ERC1155 with 2 items)
./deploy-test-nfts.sh
```

See [TEST_NFTS.md](./TEST_NFTS.md) for detailed information on test NFT contracts and usage.

For details on deployment improvements and best practices, see [DEPLOYMENT_IMPROVEMENTS.md](./DEPLOYMENT_IMPROVEMENTS.md).

