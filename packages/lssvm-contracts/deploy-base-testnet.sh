#!/bin/bash
# Helper script to deploy to Base Sepolia testnet

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

# Verify we're deploying to Base Sepolia testnet (chain ID 84532)
CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$CHAIN_ID" ] && [ "$CHAIN_ID" != "84532" ]; then
    echo "⚠️  Warning: Chain ID is $CHAIN_ID (expected 84532 for Base Sepolia testnet)"
    echo ""
    if [ "$CHAIN_ID" == "8453" ]; then
        echo "You're connected to Base Mainnet instead of Base Sepolia testnet!"
        echo ""
        echo "Please update your .env.local file:"
        echo "  Change RPC_URL from:"
        echo "    RPC_URL=https://mainnet.base.org"
        echo "  To:"
        echo "    RPC_URL=https://sepolia.base.org"
        echo ""
        echo "Or use an Alchemy/Infura endpoint for Base Sepolia:"
        echo "    RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
        echo ""
    fi
    read -p "Are you sure you want to deploy to chain $CHAIN_ID? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Extract deployer address from private key
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "Warning: Could not extract address from private key. Proceeding without --sender flag."
    SENDER_FLAG=""
else
    SENDER_FLAG="--sender $DEPLOYER_ADDRESS"
    echo "Deployer address: $DEPLOYER_ADDRESS"
    
    # For Base testnet deployments, ensure FACTORY_OWNER is set to deployer if not explicitly set
    if [ -z "$FACTORY_OWNER" ] || [ "$FACTORY_OWNER" != "$DEPLOYER_ADDRESS" ]; then
        echo "Setting FACTORY_OWNER to deployer address for Base testnet deployment..."
        export FACTORY_OWNER="$DEPLOYER_ADDRESS"
    fi
fi

# Check deployer balance
echo "Checking deployer balance..."
BALANCE=$(cast balance $DEPLOYER_ADDRESS --rpc-url $RPC_URL 2>/dev/null || echo "0")
if [ "$BALANCE" == "0" ]; then
    echo "Warning: Deployer balance is 0. You need testnet ETH for gas fees!"
    echo ""
    echo "Get testnet ETH from Base Sepolia faucet:"
    echo "  - https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
    echo "  - https://bridge.base.org/deposit"
    echo ""
    read -p "Continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 1
    fi
else
    ETH_BALANCE=$(cast --to-unit "$BALANCE" ether 2>/dev/null || echo "0")
    echo "✓ Deployer balance: $ETH_BALANCE ETH"
fi

# Set default for DEPLOY_BONDING_CURVES if not set
if [ -z "$DEPLOY_BONDING_CURVES" ]; then
    export DEPLOY_BONDING_CURVES=true
    echo "DEPLOY_BONDING_CURVES not set, defaulting to true (will deploy bonding curves)"
fi

# Run the deployment script
echo ""
echo "Deploying to Base Sepolia testnet..."
echo "RPC URL: $RPC_URL"
echo "Chain ID: $CHAIN_ID"
echo ""

# Export all required variables for forge script
export ROYALTY_REGISTRY
export PROTOCOL_FEE_RECIPIENT
export PROTOCOL_FEE_MULTIPLIER
export FACTORY_OWNER
export DEPLOY_BONDING_CURVES

forge script script/DeployForBaseTestnet.s.sol:DeployForBaseTestnet \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  $SENDER_FLAG \
  -vvvv

