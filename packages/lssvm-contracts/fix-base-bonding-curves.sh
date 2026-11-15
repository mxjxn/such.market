#!/bin/bash
# Script to fix Base Mainnet factory bonding curve whitelist
# Removes Ethereum Mainnet addresses and adds Base Mainnet addresses

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Load environment variables
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
else
    echo "Error: .env.local file not found!"
    exit 1
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

# Verify required variables
if [ -z "$RPC_URL" ] || [ -z "$PRIVATE_KEY" ]; then
    echo "Error: RPC_URL and PRIVATE_KEY (or MNEMONIC) must be set!"
    exit 1
fi

# Factory address (from Base deployment)
FACTORY_ADDRESS="0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e"

# Ethereum Mainnet addresses (to remove)
ETH_LINEAR_CURVE="0xe5d78fec1a7f42d2F3620238C498F088A866FdC5"
ETH_EXPONENTIAL_CURVE="0xfa056C602aD0C0C4EE4385b3233f2Cb06730334a"
ETH_XYK_CURVE="0xc7fB91B6cd3C67E02EC08013CEBb29b1241f3De5"
ETH_GDA_CURVE="0x1fD5876d4A3860Eb0159055a3b7Cb79fdFFf6B67"

# Base Mainnet addresses (to add)
BASE_LINEAR_CURVE="0xe41352CB8D9af18231E05520751840559C2a548A"
BASE_EXPONENTIAL_CURVE="0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6"
BASE_XYK_CURVE="0xd0A2f4ae5E816ec09374c67F6532063B60dE037B"
BASE_GDA_CURVE="0x4f1627be4C72aEB9565D4c751550C4D262a96B51"

echo "Fixing Base Mainnet factory bonding curve whitelist..."
echo "Factory: $FACTORY_ADDRESS"
echo ""

# Verify we're on Base Mainnet
CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ "$CHAIN_ID" != "8453" ]; then
    echo "Warning: Chain ID is $CHAIN_ID (expected 8453 for Base Mainnet)"
    read -p "Continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        exit 1
    fi
fi

# Get deployer address for nonce checking
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")

# Helper function to send transaction and wait for confirmation
send_and_wait() {
    # Check current nonce before sending
    if [ -n "$DEPLOYER_ADDRESS" ]; then
        local current_nonce=$(cast nonce $DEPLOYER_ADDRESS --rpc-url $RPC_URL 2>/dev/null || echo "0")
        echo "  Current nonce: $current_nonce"
    fi
    
    # Send transaction - cast send waits for confirmation by default
    echo "  Sending transaction..."
    local output=$(cast send "$@" --private-key $PRIVATE_KEY --rpc-url $RPC_URL 2>&1)
    local exit_code=$?
    
    # Check for errors
    if [ $exit_code -ne 0 ] || echo "$output" | grep -qi "error\|failed"; then
        echo "  ✗ Transaction failed:"
        echo "$output" | grep -A 10 -i "error\|failed" | head -15
        return 1
    fi
    
    # Extract transaction hash
    local tx_hash=$(echo "$output" | grep -oE "0x[a-fA-F0-9]{64}" | head -1 || echo "")
    
    if [ -n "$tx_hash" ]; then
        echo "  ✓ Transaction confirmed: $tx_hash"
        # Small delay before next transaction to ensure state is updated
        sleep 2
        return 0
    else
        # If no hash but no error, transaction might have succeeded
        if echo "$output" | grep -qi "success\|confirmed"; then
            echo "  ✓ Transaction appears successful"
            sleep 2
            return 0
        else
            echo "  ⚠ Could not verify transaction status"
            echo "  Output preview:" 
            echo "$output" | head -10
            sleep 3  # Wait longer if uncertain
            return 1
        fi
    fi
}

# Step 1: Remove Ethereum Mainnet addresses
echo "Step 1: Removing Ethereum Mainnet bonding curve addresses..."
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $ETH_LINEAR_CURVE false
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $ETH_EXPONENTIAL_CURVE false
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $ETH_XYK_CURVE false
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $ETH_GDA_CURVE false

echo "✓ Removed Ethereum Mainnet addresses"
echo ""

# Step 2: Add Base Mainnet addresses
echo "Step 2: Adding Base Mainnet bonding curve addresses..."
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $BASE_LINEAR_CURVE true
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $BASE_EXPONENTIAL_CURVE true
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $BASE_XYK_CURVE true
send_and_wait $FACTORY_ADDRESS "setBondingCurveAllowed(address,bool)" $BASE_GDA_CURVE true

echo "✓ Added Base Mainnet addresses"
echo ""

# Step 3: Verify
echo "Step 3: Verifying whitelist status..."
echo ""

check_curve() {
    local address=$1
    local name=$2
    local result=$(cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $address --rpc-url $RPC_URL 2>/dev/null || echo "0x0")
    if [ "$result" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]; then
        echo "  ✓ $name is whitelisted"
    else
        echo "  ✗ $name is NOT whitelisted"
    fi
}

echo "Base Mainnet curves:"
check_curve $BASE_LINEAR_CURVE "LinearCurve"
check_curve $BASE_EXPONENTIAL_CURVE "ExponentialCurve"
check_curve $BASE_XYK_CURVE "XykCurve"
check_curve $BASE_GDA_CURVE "GDACurve"

echo ""
echo "Ethereum Mainnet curves (should be removed):"
check_curve $ETH_LINEAR_CURVE "LinearCurve (ETH)"
check_curve $ETH_EXPONENTIAL_CURVE "ExponentialCurve (ETH)"
check_curve $ETH_XYK_CURVE "XykCurve (ETH)"
check_curve $ETH_GDA_CURVE "GDACurve (ETH)"

echo ""
echo "✅ Factory bonding curve whitelist updated!"

