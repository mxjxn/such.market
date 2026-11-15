#!/bin/bash
# Helper script to deploy to local Anvil node

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Load and export environment variables
if [ -f .env.local ]; then
    set -a  # Automatically export all variables
    source .env.local
    set +a  # Turn off automatic export
else
    echo "Error: .env.local file not found!"
    echo "Please create .env.local with the required environment variables."
    exit 1
fi

# Strip quotes from MNEMONIC if present (handles both single and double quotes from .env files)
if [ -n "$MNEMONIC" ]; then
    MNEMONIC=$(echo "$MNEMONIC" | sed "s/^[[:space:]]*['\"]//; s/['\"][[:space:]]*$//; s/^[[:space:]]*//; s/[[:space:]]*$//")
fi

# Always prefer MNEMONIC over PRIVATE_KEY if MNEMONIC is set
if [ -n "$MNEMONIC" ]; then
    # Use MNEMONIC_INDEX if set, otherwise default to 2 (third address)
    MNEMONIC_INDEX=${MNEMONIC_INDEX:-2}
    echo "Using MNEMONIC to derive private key (ignoring PRIVATE_KEY if set)..."
    echo "Using mnemonic index $MNEMONIC_INDEX (address index $MNEMONIC_INDEX)"
    # Derive private key from mnemonic at specified index
    DERIVED_PRIVATE_KEY=$(cast wallet private-key "$MNEMONIC" $MNEMONIC_INDEX 2>/dev/null || echo "")
    
    if [ -n "$DERIVED_PRIVATE_KEY" ]; then
        PRIVATE_KEY="$DERIVED_PRIVATE_KEY"
        DERIVED_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
        echo "✓ Derived private key from mnemonic (index $MNEMONIC_INDEX)"
        echo "  Address: $DERIVED_ADDRESS"
    else
        echo "Error: Could not derive private key from mnemonic at index $MNEMONIC_INDEX!"
        exit 1
    fi
fi

# Verify required variables are set
if [ -z "$ROYALTY_REGISTRY" ] || [ -z "$RPC_URL" ] || [ -z "$PRIVATE_KEY" ]; then
    echo "Error: Required environment variables not set!"
    echo "Please check your .env.local file."
    echo "Required: ROYALTY_REGISTRY, RPC_URL, and either MNEMONIC or PRIVATE_KEY"
    exit 1
fi

# Check if Anvil is running
if ! curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "Error: Anvil is not running on http://127.0.0.1:8545"
    echo "Please start Anvil in another terminal: anvil"
    exit 1
fi

# Verify we're connecting to local Anvil (not a remote network)
LOCAL_RPC="http://127.0.0.1:8545"
if [ "$RPC_URL" != "$LOCAL_RPC" ]; then
    echo "Warning: RPC_URL is set to $RPC_URL, but we expect $LOCAL_RPC for local deployment"
    echo "Forcing RPC_URL to local Anvil node..."
    RPC_URL="$LOCAL_RPC"
fi

# Check chain ID - if it's not 31337 (default Anvil), warn user
CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$CHAIN_ID" ] && [ "$CHAIN_ID" != "31337" ]; then
    echo "Warning: Chain ID is $CHAIN_ID (expected 31337 for local Anvil)"
    echo "If Anvil is forking a network, this is normal, but ensure you're not broadcasting to mainnet!"
fi

# Extract deployer address from private key
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "Warning: Could not extract address from private key. Proceeding without --sender flag."
    SENDER_FLAG=""
else
    SENDER_FLAG="--sender $DEPLOYER_ADDRESS"
    echo "Deployer address: $DEPLOYER_ADDRESS"
    
    # For local deployments, automatically set FACTORY_OWNER to deployer address
    # This ensures the deployer can configure the factory after deployment
    if [ -z "$FACTORY_OWNER" ] || [ "$FACTORY_OWNER" != "$DEPLOYER_ADDRESS" ]; then
        echo "Setting FACTORY_OWNER to deployer address for local deployment..."
        export FACTORY_OWNER="$DEPLOYER_ADDRESS"
    fi
fi

# Run the deployment script
# Force use of local RPC and add flags to prevent accidental mainnet broadcasts
echo "Deploying to local Anvil node at $RPC_URL..."
echo "Note: If Anvil is forking a network, ensure transactions are sent to local node only."
echo ""

# Use explicit localhost RPC to prevent forge from using a different endpoint
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url "$LOCAL_RPC" \
  --private-key $PRIVATE_KEY \
  --skip test \
  --broadcast \
  --legacy \
  --slow \
  $SENDER_FLAG \
  -vvvv

