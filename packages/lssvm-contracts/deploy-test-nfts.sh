#!/bin/bash
# Helper script to deploy test NFT contracts (ERC721 and ERC1155)

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Load environment variables if .env.local exists
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
fi

# Strip quotes from MNEMONIC if present
if [ -n "$MNEMONIC" ]; then
    MNEMONIC=$(echo "$MNEMONIC" | sed "s/^[[:space:]]*['\"]//; s/['\"][[:space:]]*$//; s/^[[:space:]]*//; s/[[:space:]]*$//")
fi

# Derive private key from mnemonic if set
if [ -n "$MNEMONIC" ]; then
    MNEMONIC_INDEX=${MNEMONIC_INDEX:-2}
    PRIVATE_KEY=$(cast wallet private-key "$MNEMONIC" $MNEMONIC_INDEX 2>/dev/null || echo "")
    if [ -z "$PRIVATE_KEY" ]; then
        echo "Error: Could not derive private key from mnemonic!"
        exit 1
    fi
fi

# Use default Anvil private key if neither MNEMONIC nor PRIVATE_KEY is set
PRIVATE_KEY=${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}

# Default to local Anvil if RPC_URL not set
RPC_URL=${RPC_URL:-http://127.0.0.1:8545}

# Extract deployer address
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "Error: Could not extract deployer address from private key"
    exit 1
fi

echo "Deploying test NFTs..."
echo "Deployer: $DEPLOYER_ADDRESS"
echo "RPC URL: $RPC_URL"
echo ""

# Check if we're on local Anvil
if [[ "$RPC_URL" == *"127.0.0.1:8545"* ]] || [[ "$RPC_URL" == *"localhost:8545"* ]]; then
    echo "Deploying to local Anvil..."
    forge script script/DeployTestNFTs.s.sol:DeployTestNFTs \
      --rpc-url $RPC_URL \
      --private-key $PRIVATE_KEY \
      --broadcast \
      -vvv
else
    echo "Deploying to network..."
    # For testnet/mainnet, add verification
    if [ -n "$ETHERSCAN_API_KEY" ]; then
        forge script script/DeployTestNFTs.s.sol:DeployTestNFTs \
          --rpc-url $RPC_URL \
          --private-key $PRIVATE_KEY \
          --broadcast \
          --verify \
          -vvv
    else
        forge script script/DeployTestNFTs.s.sol:DeployTestNFTs \
          --rpc-url $RPC_URL \
          --private-key $PRIVATE_KEY \
          --broadcast \
          -vvv
    fi
fi

echo ""
echo "✅ Test NFTs deployed successfully!"

