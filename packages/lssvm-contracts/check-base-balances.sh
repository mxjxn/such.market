#!/bin/bash

# Script to check actual balances of first 5 wallets on Base mainnet
# Usage: 
#   export MNEMONIC="your twelve word seed phrase here"
#   ./check-base-balances.sh
#
# Or add MNEMONIC to .env.local:
#   MNEMONIC="your twelve word seed phrase here"
#   ./check-base-balances.sh

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Try to read MNEMONIC from .env.local if not set as environment variable
if [ -z "$MNEMONIC" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="$SCRIPT_DIR/.env.local"
    
    if [ -f "$ENV_FILE" ]; then
        # Extract MNEMONIC from .env.local file, handling both single and double quotes
        # Get the line with MNEMONIC, then extract everything after the = sign
        MNEMONIC_LINE=$(grep -E "^[[:space:]]*MNEMONIC[[:space:]]*=" "$ENV_FILE" | head -1)
        if [ -n "$MNEMONIC_LINE" ]; then
            # Extract value after =, handling quotes and whitespace
            MNEMONIC=$(echo "$MNEMONIC_LINE" | sed -E "s/^[[:space:]]*MNEMONIC[[:space:]]*=[[:space:]]*//" | sed "s/^['\"]//; s/['\"]$//")
        fi
    fi
fi

# Strip any remaining quotes from MNEMONIC if present
if [ -n "$MNEMONIC" ]; then
    # Remove leading/trailing single or double quotes and whitespace
    MNEMONIC=$(echo "$MNEMONIC" | sed "s/^[[:space:]]*['\"]//; s/['\"][[:space:]]*$//; s/^[[:space:]]*//; s/[[:space:]]*$//")
fi

# Check if mnemonic is provided
if [ -z "$MNEMONIC" ]; then
    echo "Error: MNEMONIC environment variable is not set and not found in .env.local"
    echo ""
    echo "Usage:"
    echo "  export MNEMONIC=\"your twelve word seed phrase here\""
    echo "  $0"
    echo ""
    echo "Or add MNEMONIC to .env.local:"
    echo "  MNEMONIC=\"your twelve word seed phrase here\""
    echo "  $0"
    exit 1
fi

BASE_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"

echo "Checking actual balances on Base mainnet..."
echo "Using mnemonic: ${MNEMONIC:0:20}..."
echo "RPC URL: $BASE_RPC_URL"
echo ""

# Get the first 5 account addresses from the mnemonic
echo "Deriving account addresses..."
ACCOUNT1=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index 0)
ACCOUNT2=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index 1)
ACCOUNT3=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index 2)
ACCOUNT4=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index 3)
ACCOUNT5=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index 4)

echo "Account addresses:"
echo "  Account 1: $ACCOUNT1"
echo "  Account 2: $ACCOUNT2"
echo "  Account 3: $ACCOUNT3"
echo "  Account 4: $ACCOUNT4"
echo "  Account 5: $ACCOUNT5"
echo ""

# Check actual balances on Base mainnet
echo "Checking actual balances on Base mainnet..."
echo ""

for i in {0..4}; do
    ADDRESS=$(cast wallet address --mnemonic "$MNEMONIC" --mnemonic-index $i)
    BALANCE=$(cast balance "$ADDRESS" --rpc-url "$BASE_RPC_URL" 2>/dev/null || echo "0")
    ETH_BALANCE=$(cast --to-unit "$BALANCE" ether 2>/dev/null || echo "0")
    echo "Account $((i+1)) ($ADDRESS):"
    echo "  Balance: $ETH_BALANCE ETH"
    echo ""
done

echo "Done!"

