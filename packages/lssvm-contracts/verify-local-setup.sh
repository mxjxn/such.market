#!/bin/bash
# Quick verification script to check if local setup is ready

set -e

# Disable Foundry nightly build warnings
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Verifying Local Setup ==="
echo ""

# Check 1: Anvil is running
echo -n "Checking if Anvil is running... "
if curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Please start Anvil: anvil"
    exit 1
fi

# Check 2: .env.local exists
echo -n "Checking for .env.local file... "
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Please create .env.local with required variables"
    exit 1
fi

# Check 3: Required environment variables
echo -n "Checking required environment variables... "
if [ -f .env.local ]; then
    set -a
    source .env.local
    set +a
    
    MISSING_VARS=()
    [ -z "$RPC_URL" ] && MISSING_VARS+=("RPC_URL")
    [ -z "$ROYALTY_REGISTRY" ] && MISSING_VARS+=("ROYALTY_REGISTRY")
    
    # Check for either MNEMONIC or PRIVATE_KEY
    HAS_MNEMONIC_OR_KEY=false
    
    # Strip quotes from MNEMONIC if present
    if [ -n "$MNEMONIC" ]; then
        MNEMONIC=$(echo "$MNEMONIC" | sed "s/^[[:space:]]*['\"]//; s/['\"][[:space:]]*$//; s/^[[:space:]]*//; s/[[:space:]]*$//")
        if [ -n "$MNEMONIC" ]; then
            HAS_MNEMONIC_OR_KEY=true
        fi
    fi
    
    if [ -n "$PRIVATE_KEY" ]; then
        HAS_MNEMONIC_OR_KEY=true
    fi
    
    if [ "$HAS_MNEMONIC_OR_KEY" = false ]; then
        MISSING_VARS+=("MNEMONIC or PRIVATE_KEY")
    fi
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo "  Missing variables: ${MISSING_VARS[*]}"
        exit 1
    fi
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

# Check 4: Foundry tools available
echo -n "Checking Foundry tools... "
if command -v forge > /dev/null && command -v cast > /dev/null && command -v anvil > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

# Check 5: Can connect to Anvil
echo -n "Checking Anvil connection... "
CHAIN_ID=$(cast chain-id --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "")
if [ -n "$CHAIN_ID" ]; then
    echo -e "${GREEN}✓${NC} (Chain ID: $CHAIN_ID)"
else
    echo -e "${RED}✗${NC}"
    echo "  Cannot connect to Anvil"
    exit 1
fi

# Check 6: Derive private key from mnemonic if needed, then validate
echo -n "Checking private key... "

# Always prefer MNEMONIC over PRIVATE_KEY if MNEMONIC is set
if [ -n "$MNEMONIC" ]; then
    # Use MNEMONIC_INDEX if set, otherwise default to 2 (third address)
    MNEMONIC_INDEX=${MNEMONIC_INDEX:-2}
    PRIVATE_KEY=$(cast wallet private-key "$MNEMONIC" $MNEMONIC_INDEX 2>/dev/null || echo "")
    if [ -z "$PRIVATE_KEY" ]; then
        echo -e "${RED}✗${NC}"
        echo "  Could not derive private key from mnemonic at index $MNEMONIC_INDEX"
        exit 1
    fi
fi

DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "")
if [ -n "$DEPLOYER_ADDRESS" ]; then
    echo -e "${GREEN}✓${NC} ($DEPLOYER_ADDRESS)"
else
    echo -e "${RED}✗${NC}"
    echo "  Invalid private key"
    exit 1
fi

# Check 7: Deployer has balance
echo -n "Checking deployer balance... "
BALANCE=$(cast balance $DEPLOYER_ADDRESS --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "0")
if [ "$BALANCE" != "0" ]; then
    ETH_BALANCE=$(cast --to-unit "$BALANCE" ether 2>/dev/null || echo "0")
    echo -e "${GREEN}✓${NC} ($ETH_BALANCE ETH)"
else
    echo -e "${YELLOW}⚠${NC} (0 ETH - this is normal for a fresh Anvil instance)"
fi

echo ""
echo -e "${GREEN}=== Setup Verified! ===${NC}"
echo ""
echo "You can now run:"
echo "  ./deploy-local.sh      # Deploy contracts"
echo "  ./test-integration.sh   # Test deployed contracts"

