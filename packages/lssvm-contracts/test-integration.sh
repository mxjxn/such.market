#!/bin/bash
# Integration test script for deployed contracts on local Anvil node
# This script verifies that deployed contracts are working correctly

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
else
    echo -e "${RED}Error: .env.local file not found!${NC}"
    exit 1
fi

RPC_URL=${RPC_URL:-http://127.0.0.1:8545}

# Strip quotes from MNEMONIC if present
if [ -n "$MNEMONIC" ]; then
    MNEMONIC=$(echo "$MNEMONIC" | sed "s/^[[:space:]]*['\"]//; s/['\"][[:space:]]*$//; s/^[[:space:]]*//; s/[[:space:]]*$//")
fi

# Always prefer MNEMONIC over PRIVATE_KEY if MNEMONIC is set
if [ -n "$MNEMONIC" ]; then
    # Use MNEMONIC_INDEX if set, otherwise default to 2 (third address)
    MNEMONIC_INDEX=${MNEMONIC_INDEX:-2}
    echo "Using MNEMONIC to derive private key (ignoring PRIVATE_KEY if set)..."
    echo "Using mnemonic index $MNEMONIC_INDEX (address index $MNEMONIC_INDEX)"
    DERIVED_PRIVATE_KEY=$(cast wallet private-key "$MNEMONIC" $MNEMONIC_INDEX 2>/dev/null || echo "")
    if [ -n "$DERIVED_PRIVATE_KEY" ]; then
        PRIVATE_KEY="$DERIVED_PRIVATE_KEY"
        DERIVED_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
        echo -e "${GREEN}✓ Derived private key from mnemonic (index $MNEMONIC_INDEX)${NC}"
        echo "  Address: $DERIVED_ADDRESS"
    else
        echo -e "${RED}Error: Could not derive private key from mnemonic at index $MNEMONIC_INDEX!${NC}"
        exit 1
    fi
fi

# Fallback to default Anvil private key if neither MNEMONIC nor PRIVATE_KEY is set
PRIVATE_KEY=${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}

# Check if Anvil is running
if ! curl -s $RPC_URL > /dev/null 2>&1; then
    echo -e "${RED}Error: Anvil is not running on $RPC_URL${NC}"
    echo "Please start Anvil in another terminal: anvil"
    exit 1
fi

# Detect chain ID from Anvil
CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "31337")
echo "Detected chain ID: $CHAIN_ID"

# Extract deployed addresses from broadcast file (use detected chain ID)
BROADCAST_FILE="broadcast/DeployAll.s.sol/$CHAIN_ID/run-latest.json"
if [ ! -f "$BROADCAST_FILE" ]; then
    echo -e "${RED}Error: Broadcast file not found: $BROADCAST_FILE${NC}"
    echo "Please deploy contracts first using ./deploy-local.sh"
    echo "Looking for broadcast file at: $BROADCAST_FILE"
    exit 1
fi
echo "Using broadcast file: $BROADCAST_FILE"

echo -e "${GREEN}=== Integration Tests for Deployed Contracts ===${NC}\n"

# Extract addresses from broadcast file (simplified - assumes jq is available)
if command -v jq &> /dev/null; then
    FACTORY_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "LSSVMPairFactory") | .contractAddress' "$BROADCAST_FILE" | head -1)
    ROUTER_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "VeryFastRouter") | .contractAddress' "$BROADCAST_FILE" | head -1)
    LINEAR_CURVE=$(jq -r '.transactions[] | select(.contractName == "LinearCurve") | .contractAddress' "$BROADCAST_FILE" | head -1)
    ROYALTY_ENGINE=$(jq -r '.transactions[] | select(.contractName == "RoyaltyEngine") | .contractAddress' "$BROADCAST_FILE" | head -1)
else
    echo -e "${YELLOW}Warning: jq not found. Please set addresses manually:${NC}"
    echo "export FACTORY_ADDRESS=<address>"
    echo "export ROUTER_ADDRESS=<address>"
    echo "export LINEAR_CURVE=<address>"
    echo "export ROYALTY_ENGINE=<address>"
    exit 1
fi

if [ -z "$FACTORY_ADDRESS" ] || [ "$FACTORY_ADDRESS" == "null" ]; then
    echo -e "${RED}Error: Could not extract factory address from broadcast file${NC}"
    exit 1
fi

echo "Using deployed addresses:"
echo "  Factory: $FACTORY_ADDRESS"
echo "  Router: $ROUTER_ADDRESS"
echo "  LinearCurve: $LINEAR_CURVE"
echo "  RoyaltyEngine: $ROYALTY_ENGINE"
echo ""

# Test 1: Check factory owner
echo -e "${GREEN}[Test 1] Checking factory owner...${NC}"
FACTORY_OWNER_RAW=$(cast call $FACTORY_ADDRESS "owner()" --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -z "$FACTORY_OWNER_RAW" ]; then
    echo -e "${RED}  ✗ Failed to get factory owner${NC}"
    exit 1
else
    # Extract address from padded bytes32 (take last 40 chars and add 0x prefix)
    FACTORY_OWNER=$(echo "$FACTORY_OWNER_RAW" | sed 's/0x000000000000000000000000/0x/' | tr '[:upper:]' '[:lower:]')
    FACTORY_OWNER=$(cast --to-checksum-address $FACTORY_OWNER 2>/dev/null || echo "$FACTORY_OWNER")
    echo -e "${GREEN}  ✓ Factory owner: $FACTORY_OWNER${NC}"
    
    # Check if it matches deployer address
    DEPLOYER_CHECKSUM=$(cast --to-checksum-address $DERIVED_ADDRESS 2>/dev/null || echo "$DERIVED_ADDRESS")
    if [ "$FACTORY_OWNER" == "$DEPLOYER_CHECKSUM" ]; then
        echo -e "${GREEN}  ✓ Factory owner matches deployer address${NC}"
    else
        echo -e "${YELLOW}  ⚠ Factory owner does not match deployer (deployer: $DEPLOYER_CHECKSUM)${NC}"
    fi
fi

# Test 2: Check bonding curve whitelist
echo -e "${GREEN}[Test 2] Checking bonding curve whitelist...${NC}"
CURVE_ALLOWED=$(cast call $FACTORY_ADDRESS "bondingCurveAllowed(address)" $LINEAR_CURVE --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ "$CURVE_ALLOWED" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]; then
    echo -e "${GREEN}  ✓ LinearCurve is whitelisted${NC}"
else
    echo -e "${RED}  ✗ LinearCurve is NOT whitelisted${NC}"
    echo -e "${YELLOW}  Response: $CURVE_ALLOWED${NC}"
fi

# Test 3: Check router whitelist
echo -e "${GREEN}[Test 3] Checking router whitelist...${NC}"
# routerStatus returns (bool allowed, bool wasEverTouched) as concatenated hex
ROUTER_STATUS=$(cast call $FACTORY_ADDRESS "routerStatus(address)" $ROUTER_ADDRESS --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$ROUTER_STATUS" ]; then
    # Extract the first 66 chars (0x + 64 chars for first bool)
    ROUTER_ALLOWED=$(echo "$ROUTER_STATUS" | cut -c1-66)
    if [ "$ROUTER_ALLOWED" == "0x0000000000000000000000000000000000000000000000000000000000000001" ]; then
        echo -e "${GREEN}  ✓ Router is whitelisted${NC}"
    else
        echo -e "${RED}  ✗ Router is NOT whitelisted${NC}"
        echo -e "${YELLOW}  Response: $ROUTER_STATUS${NC}"
    fi
else
    echo -e "${RED}  ✗ Failed to check router status${NC}"
fi

# Test 4: Check protocol fee recipient
echo -e "${GREEN}[Test 4] Checking protocol fee recipient...${NC}"
FEE_RECIPIENT_RAW=$(cast call $FACTORY_ADDRESS "protocolFeeRecipient()" --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$FEE_RECIPIENT_RAW" ]; then
    # Extract address from padded bytes32
    FEE_RECIPIENT=$(echo "$FEE_RECIPIENT_RAW" | sed 's/0x000000000000000000000000/0x/' | tr '[:upper:]' '[:lower:]')
    FEE_RECIPIENT=$(cast --to-checksum-address $FEE_RECIPIENT 2>/dev/null || echo "$FEE_RECIPIENT")
    echo -e "${GREEN}  ✓ Protocol fee recipient: $FEE_RECIPIENT${NC}"
else
    echo -e "${RED}  ✗ Failed to get protocol fee recipient${NC}"
fi

# Test 5: Check protocol fee multiplier
echo -e "${GREEN}[Test 5] Checking protocol fee multiplier...${NC}"
FEE_MULTIPLIER=$(cast call $FACTORY_ADDRESS "protocolFeeMultiplier()" --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$FEE_MULTIPLIER" ]; then
    FEE_PERCENT=$(cast --to-unit $FEE_MULTIPLIER 18 | awk '{printf "%.2f%%", $1 * 100}')
    echo -e "${GREEN}  ✓ Protocol fee multiplier: $FEE_MULTIPLIER ($FEE_PERCENT)${NC}"
else
    echo -e "${RED}  ✗ Failed to get protocol fee multiplier${NC}"
fi

# Test 6: Verify RoyaltyEngine deployment
echo -e "${GREEN}[Test 6] Checking RoyaltyEngine deployment...${NC}"
# Check if RoyaltyEngine has code deployed
ROYALTY_ENGINE_CODE=$(cast code $ROYALTY_ENGINE --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ -n "$ROYALTY_ENGINE_CODE" ] && [ "$ROYALTY_ENGINE_CODE" != "0x" ]; then
    ROYALTY_ENGINE_CHECKSUM=$(cast --to-checksum-address $ROYALTY_ENGINE 2>/dev/null || echo "$ROYALTY_ENGINE")
    echo -e "${GREEN}  ✓ RoyaltyEngine deployed at: $ROYALTY_ENGINE_CHECKSUM${NC}"
    echo -e "${GREEN}  ✓ RoyaltyEngine has code deployed${NC}"
else
    echo -e "${RED}  ✗ RoyaltyEngine has no code or deployment failed${NC}"
fi

echo ""
echo -e "${GREEN}=== Integration Tests Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Run full test suite: forge test"
echo "  2. Test pool creation: See LOCAL_TESTING.md"
echo "  3. Test trading: See LOCAL_TESTING.md"

