# sudoAMM v2 Deployment Checklist

Use this checklist to ensure a complete and correct deployment of the sudoAMM v2 protocol.

## Pre-Deployment

- [ ] Install Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- [ ] Clone the repository
- [ ] Run `forge install` to install dependencies
- [ ] Run `forge build` to ensure contracts compile
- [ ] Run `forge test` to ensure all tests pass
- [ ] Copy `script/.env.example` to `script/.env` or project root `.env`
- [ ] Configure all environment variables in `.env`:
  - [ ] `RPC_URL` - RPC endpoint for target network
  - [ ] `ETHERSCAN_API_KEY` - API key for contract verification
  - [ ] `PRIVATE_KEY` or `MNEMONIC` - Deployment account credentials
  - [ ] `ROYALTY_REGISTRY` - Manifold Royalty Registry address for your network
  - [ ] `PROTOCOL_FEE_RECIPIENT` - Address to receive protocol fees
  - [ ] `PROTOCOL_FEE_MULTIPLIER` - Fee multiplier (max 0.1e18 = 10%)
  - [ ] `FACTORY_OWNER` - Address to own the factory
- [ ] Ensure deployment account has sufficient funds for gas
- [ ] Review security considerations in README.md

## Deployment (Option 1: All at Once)

- [ ] Run simulation: `forge script script/DeployAll.s.sol:DeployAll --rpc-url $RPC_URL -vvvv`
- [ ] Review simulation output for errors
- [ ] Deploy: `forge script script/DeployAll.s.sol:DeployAll --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Save all deployed contract addresses from output
- [ ] Verify automatic configuration completed (if deployer is factory owner)

## Deployment (Option 2: Step by Step)

### Step 1: Core Contracts
- [ ] Run: `forge script script/01_DeployCore.s.sol:DeployCore --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Record deployed addresses:
  - [ ] RoyaltyEngine: `___________________________________`
  - [ ] LSSVMPairERC721ETH: `___________________________________`
  - [ ] LSSVMPairERC721ERC20: `___________________________________`
  - [ ] LSSVMPairERC1155ETH: `___________________________________`
  - [ ] LSSVMPairERC1155ERC20: `___________________________________`
  - [ ] LSSVMPairFactory: `___________________________________`
- [ ] Add `FACTORY_ADDRESS` to `.env` file

### Step 2: Bonding Curves
- [ ] Run: `forge script script/02_DeployBondingCurves.s.sol:DeployBondingCurves --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Record deployed addresses:
  - [ ] LinearCurve: `___________________________________`
  - [ ] ExponentialCurve: `___________________________________`
  - [ ] XykCurve: `___________________________________`
  - [ ] GDACurve: `___________________________________`

### Step 3: Router
- [ ] Run: `forge script script/03_DeployRouter.s.sol:DeployRouter --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Record deployed address:
  - [ ] VeryFastRouter: `___________________________________`

### Step 4: Property Checkers
- [ ] Run: `forge script script/04_DeployPropertyCheckers.s.sol:DeployPropertyCheckers --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Record deployed addresses:
  - [ ] MerklePropertyChecker: `___________________________________`
  - [ ] RangePropertyChecker: `___________________________________`
  - [ ] PropertyCheckerFactory: `___________________________________`

### Step 5: Settings
- [ ] Run: `forge script script/05_DeploySettings.s.sol:DeploySettings --rpc-url $RPC_URL --broadcast --verify -vvvv`
- [ ] Record deployed addresses:
  - [ ] Splitter: `___________________________________`
  - [ ] StandardSettings: `___________________________________`
  - [ ] StandardSettingsFactory: `___________________________________`

## Post-Deployment Configuration

### Whitelist Bonding Curves
- [ ] Whitelist LinearCurve: `cast send $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $LINEAR_CURVE true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`
- [ ] Whitelist ExponentialCurve: `cast send $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $EXPONENTIAL_CURVE true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`
- [ ] Whitelist XykCurve: `cast send $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $XYK_CURVE true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`
- [ ] Whitelist GDACurve: `cast send $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $GDA_CURVE true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`

### Whitelist Router
- [ ] Whitelist VeryFastRouter: `cast send $FACTORY_ADDRESS "setRouterAllowed(address,bool)" $ROUTER_ADDRESS true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`

### Optional: Whitelist Call Targets
- [ ] Identify any contracts that should be callable by pairs
- [ ] Whitelist each: `cast send $FACTORY_ADDRESS "setCallAllowed(address,bool)" $TARGET_ADDRESS true --rpc-url $RPC_URL --private-key $PRIVATE_KEY`

## Verification

### Contract Verification on Block Explorer
- [ ] Verify RoyaltyEngine is verified on Etherscan
- [ ] Verify all pair templates are verified on Etherscan
- [ ] Verify LSSVMPairFactory is verified on Etherscan
- [ ] Verify all bonding curves are verified on Etherscan
- [ ] Verify VeryFastRouter is verified on Etherscan
- [ ] Verify property checker contracts are verified on Etherscan
- [ ] Verify settings contracts are verified on Etherscan

### Functional Verification
- [ ] Verify factory owner: `cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL`
- [ ] Verify protocol fee recipient: `cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url $RPC_URL`
- [ ] Verify protocol fee multiplier: `cast call $FACTORY_ADDRESS "protocolFeeMultiplier()" --rpc-url $RPC_URL`
- [ ] Verify LinearCurve is whitelisted: `cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL`
- [ ] Verify ExponentialCurve is whitelisted: `cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $EXPONENTIAL_CURVE --rpc-url $RPC_URL`
- [ ] Verify XykCurve is whitelisted: `cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $XYK_CURVE --rpc-url $RPC_URL`
- [ ] Verify GDACurve is whitelisted: `cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $GDA_CURVE --rpc-url $RPC_URL`
- [ ] Verify VeryFastRouter is whitelisted: `cast call $FACTORY_ADDRESS "routerStatus(address)" $ROUTER_ADDRESS --rpc-url $RPC_URL`

### Test Pool Creation (Optional)
- [ ] Create a test ERC721-ETH pool using the factory
- [ ] Verify the pool was created successfully
- [ ] Test a swap on the pool (if applicable)

## Documentation

- [ ] Document all deployed contract addresses in a deployment record file
- [ ] Update any internal documentation with new addresses
- [ ] Notify relevant stakeholders of deployment completion
- [ ] Share block explorer links for all contracts

## Security

- [ ] Transfer factory ownership to multi-sig (if applicable): `cast send $FACTORY_ADDRESS "transferOwnership(address)" $MULTISIG_ADDRESS --rpc-url $RPC_URL --private-key $PRIVATE_KEY`
- [ ] Verify ownership transfer: `cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL`
- [ ] Securely backup all deployment information
- [ ] Remove private keys from environment variables
- [ ] Delete any local copies of private keys used for deployment

## Mainnet-Specific (if deploying to mainnet)

- [ ] Ensure all contracts have been audited
- [ ] Review audit reports for any critical or high-severity issues
- [ ] Test deployment on a testnet first
- [ ] Announce deployment to community (if applicable)
- [ ] Monitor contracts for the first 24-48 hours after deployment
- [ ] Have an incident response plan ready

## Notes

Record any issues, deviations from the standard process, or important observations:

```
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
```

## Sign-Off

- Deployed by: ________________
- Date: ________________
- Network: ________________
- Block number at deployment start: ________________
- Gas used (total): ________________
- Total cost: ________________
