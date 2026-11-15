# Deployment Script Improvements

This document explains the improvements made to the deployment scripts and local testing setup.

## Changes Made

### 1. Fixed Factory Auto-Configuration (`DeployAll.s.sol`)

**Problem**: The factory configuration check was using `msg.sender`, which doesn't reliably match the deployer address in Foundry scripts, causing auto-configuration to be skipped even when the deployer was the factory owner.

**Solution**: Updated `configureFactory()` function to:
- Use `tx.origin` instead of `msg.sender` for deployer detection
- Add fallback check: verify the factory's actual owner matches `FACTORY_OWNER`
- Proceed with configuration if either check passes
- Provide detailed logging when configuration is skipped

**Best Practice**: 
- Always verify the actual contract state rather than relying solely on `msg.sender`
- Use `tx.origin` for deployer detection in deployment scripts
- Add fallback checks for critical operations

**Code Location**: `script/DeployAll.s.sol`, lines 200-226

### 2. Added Sender Flag Support (`deploy-local.sh`)

**Problem**: Foundry was warning about using the default sender, which could cause confusion about which address is deploying contracts.

**Solution**: 
- Extract deployer address from `PRIVATE_KEY` using `cast wallet address`
- Automatically add `--sender` flag to forge script command
- Gracefully handle cases where address extraction fails

**Best Practice**:
- Always explicitly specify the sender address when deploying
- Derive addresses from private keys programmatically for consistency
- Provide fallback behavior when address extraction fails

**Code Location**: `deploy-local.sh`, lines 31-39

### 3. Created Comprehensive Local Testing Guide (`LOCAL_TESTING.md`)

**Purpose**: Provide step-by-step instructions for testing the protocol locally.

**Contents**:
- Prerequisites and setup
- Deployment instructions
- Factory configuration (automatic and manual)
- Complete ERC721 pool testing workflow
- Complete ERC1155 pool testing workflow
- Useful cast commands for querying contracts
- Troubleshooting guide

**Best Practice**:
- Document all testing workflows comprehensively
- Include both automatic and manual configuration paths
- Provide copy-paste ready commands with placeholders
- Include troubleshooting for common issues

**File**: `LOCAL_TESTING.md`

### 4. Updated README with Reference (`script/README.md`)

**Change**: Added reference to the comprehensive local testing guide at the beginning of the Local Testing section.

**Best Practice**:
- Keep README concise, link to detailed guides
- Provide overview of what's covered in linked documents

## Best Practices Implemented

### 1. Deployer Detection

**Why**: In Foundry scripts, `msg.sender` may not reliably represent the deployer address, especially when using `vm.startBroadcast()`.

**Implementation**:
```solidity
address deployer = tx.origin; // More reliable for deployer detection
address actualOwner = factory.owner(); // Verify actual state
bool shouldConfigure = (deployer == factoryOwner) || (actualOwner == factoryOwner);
```

**Rationale**: 
- `tx.origin` represents the original transaction sender
- Checking actual contract state provides a fallback
- Both checks ensure configuration works in various scenarios

### 2. Explicit Sender Specification

**Why**: Foundry recommends explicitly setting the sender to avoid confusion and ensure transactions are sent from the expected address.

**Implementation**:
```bash
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY)
forge script ... --sender $DEPLOYER_ADDRESS
```

**Rationale**:
- Eliminates Foundry warnings
- Makes it clear which address is deploying
- Ensures consistency across deployments

### 3. Comprehensive Documentation

**Why**: Local testing requires many steps and commands. Having everything in one place reduces errors and speeds up testing.

**Implementation**:
- Single comprehensive guide (`LOCAL_TESTING.md`)
- Step-by-step instructions for each workflow
- Copy-paste ready commands with clear placeholders
- Troubleshooting section for common issues

**Rationale**:
- Reduces time to get started
- Prevents common mistakes
- Makes testing accessible to developers at all levels

### 4. Graceful Error Handling

**Why**: Scripts should handle edge cases gracefully rather than failing silently or with unclear errors.

**Implementation**:
- Fallback checks in factory configuration
- Detailed logging when configuration is skipped
- Graceful handling of missing address extraction

**Rationale**:
- Better developer experience
- Easier debugging
- More reliable deployments

## Testing the Improvements

### Verify Auto-Configuration Works

1. Deploy using the helper script:
   ```bash
   ./deploy-local.sh
   ```

2. Check logs for "Configuration complete!" message

3. Verify bonding curves are whitelisted:
   ```bash
   cast call $FACTORY_ADDRESS \
     "bondingCurveAllowed(address)" \
     $LINEAR_CURVE \
     --rpc-url http://127.0.0.1:8545
   ```

### Verify Sender Flag

The deployment script should no longer show the "default sender" warning. Check the output for:
- "Deployer address: 0x..." message
- No "You seem to be using Foundry's default sender" error

### Test Local Testing Guide

Follow the guide in `LOCAL_TESTING.md` to:
1. Deploy contracts
2. Configure factory (if needed)
3. Create and test ERC721 pool
4. Create and test ERC1155 pool

## Future Improvements

Potential enhancements for future iterations:

1. **Automated Testing Script**: Create a script that runs through all test scenarios automatically
2. **Deployment Verification**: Add automatic verification of all deployed contracts
3. **Gas Reporting**: Include gas usage reports in deployment output
4. **Multi-Network Support**: Extend scripts to support multiple testnets easily
5. **Interactive Mode**: Add interactive prompts for missing configuration

## References

- [Foundry Book - Scripts](https://book.getfoundry.sh/tutorials/solidity-scripting)
- [Foundry Book - Anvil](https://book.getfoundry.sh/anvil/)
- [Cast Reference](https://book.getfoundry.sh/reference/cast/)

