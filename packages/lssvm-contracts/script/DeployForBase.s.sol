// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

// Core contracts
import "../src/RoyaltyEngine.sol";
import "../src/erc721/LSSVMPairERC721ETH.sol";
import "../src/erc721/LSSVMPairERC721ERC20.sol";
import "../src/erc1155/LSSVMPairERC1155ETH.sol";
import "../src/erc1155/LSSVMPairERC1155ERC20.sol";
import "../src/LSSVMPairFactory.sol";

// Router
import "../src/VeryFastRouter.sol";
import "../src/ILSSVMPairFactoryLike.sol";
import "../src/LSSVMRouter.sol";
import "../src/bonding-curves/ICurve.sol";

/**
 * @title Base Mainnet Deployment Script (Reusing Sudoswap Bonding Curves)
 * @notice Deploys factory and router contracts, reusing stateless bonding curves from sudoswap
 * @dev This script deploys:
 *      1. RoyaltyEngine
 *      2. Pair Templates (ERC721ETH, ERC721ERC20, ERC1155ETH, ERC1155ERC20)
 *      3. LSSVMPairFactory
 *      4. VeryFastRouter
 * 
 *      It then whitelists sudoswap's bonding curves (deployed on Base Mainnet):
 *      - LinearCurve: 0xe41352CB8D9af18231E05520751840559C2a548A
 *      - ExponentialCurve: 0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6
 *      - XYKCurve: 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B
 *      - GDACurve: 0x4f1627be4C72aEB9565D4c751550C4D262a96B51
 * 
 * Required environment variables:
 *      - ROYALTY_REGISTRY: Address of the Manifold Royalty Registry for Base
 *      - PROTOCOL_FEE_RECIPIENT: Address to receive protocol fees
 *      - PROTOCOL_FEE_MULTIPLIER: Protocol fee multiplier (in base 1e18, max 0.1e18 = 10%)
 *      - FACTORY_OWNER: Address that will own the factory contract
 * 
 * Usage:
 *      forge script script/DeployForBase.s.sol:DeployForBase --rpc-url $RPC_URL --broadcast --verify
 */
contract DeployForBase is Script {
    // Deployment state
    RoyaltyEngine public royaltyEngine;
    LSSVMPairERC721ETH public erc721ETHTemplate;
    LSSVMPairERC721ERC20 public erc721ERC20Template;
    LSSVMPairERC1155ETH public erc1155ETHTemplate;
    LSSVMPairERC1155ERC20 public erc1155ERC20Template;
    LSSVMPairFactory public factory;
    VeryFastRouter public router;

    // Sudoswap bonding curve addresses (Base Mainnet)
    address constant LINEAR_CURVE = 0xe41352CB8D9af18231E05520751840559C2a548A;
    address constant EXPONENTIAL_CURVE = 0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6;
    address constant XYK_CURVE = 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B;
    address constant GDA_CURVE = 0x4f1627be4C72aEB9565D4c751550C4D262a96B51;

    function run() external {
        // Load configuration from environment variables
        address royaltyRegistry = vm.envAddress("ROYALTY_REGISTRY");
        address payable protocolFeeRecipient = payable(vm.envAddress("PROTOCOL_FEE_RECIPIENT"));
        uint256 protocolFeeMultiplier = vm.envUint("PROTOCOL_FEE_MULTIPLIER");
        address factoryOwner = vm.envAddress("FACTORY_OWNER");

        vm.startBroadcast();

        // ===== STEP 1: Deploy Core Contracts =====
        console.log("=== STEP 1: Deploying Core Contracts ===");
        deployCore(royaltyRegistry, protocolFeeRecipient, protocolFeeMultiplier, factoryOwner);

        // ===== STEP 2: Deploy Router =====
        console.log("\n=== STEP 2: Deploying Router ===");
        deployRouter();

        // ===== STEP 3: Configure Factory =====
        console.log("\n=== STEP 3: Configuring Factory ===");
        configureFactory();

        vm.stopBroadcast();

        // Print deployment summary
        printSummary();
    }

    function deployCore(
        address royaltyRegistry,
        address payable protocolFeeRecipient,
        uint256 protocolFeeMultiplier,
        address factoryOwner
    ) internal {
        // Deploy RoyaltyEngine
        console.log("Deploying RoyaltyEngine...");
        royaltyEngine = new RoyaltyEngine(royaltyRegistry);
        console.log("RoyaltyEngine:", address(royaltyEngine));

        // Deploy Pair Templates
        console.log("Deploying Pair Templates...");
        erc721ETHTemplate = new LSSVMPairERC721ETH(royaltyEngine);
        console.log("LSSVMPairERC721ETH:", address(erc721ETHTemplate));
        
        erc721ERC20Template = new LSSVMPairERC721ERC20(royaltyEngine);
        console.log("LSSVMPairERC721ERC20:", address(erc721ERC20Template));
        
        erc1155ETHTemplate = new LSSVMPairERC1155ETH(royaltyEngine);
        console.log("LSSVMPairERC1155ETH:", address(erc1155ETHTemplate));
        
        erc1155ERC20Template = new LSSVMPairERC1155ERC20(royaltyEngine);
        console.log("LSSVMPairERC1155ERC20:", address(erc1155ERC20Template));

        // Deploy Factory
        console.log("Deploying LSSVMPairFactory...");
        factory = new LSSVMPairFactory(
            erc721ETHTemplate,
            erc721ERC20Template,
            erc1155ETHTemplate,
            erc1155ERC20Template,
            protocolFeeRecipient,
            protocolFeeMultiplier,
            factoryOwner
        );
        console.log("LSSVMPairFactory:", address(factory));
    }

    function deployRouter() internal {
        router = new VeryFastRouter(ILSSVMPairFactoryLike(address(factory)));
        console.log("VeryFastRouter:", address(router));
    }

    function configureFactory() internal {
        // Check if deployer is the factory owner
        address factoryOwner = vm.envAddress("FACTORY_OWNER");
        address deployer = tx.origin; // Use tx.origin for deployer address
        
        // Fallback: verify factory's actual owner matches expected owner
        address actualOwner = factory.owner();
        bool shouldConfigure = (deployer == factoryOwner) || (actualOwner == factoryOwner);
        
        if (shouldConfigure) {
            console.log("Whitelisting sudoswap bonding curves...");
            factory.setBondingCurveAllowed(ICurve(LINEAR_CURVE), true);
            console.log("  LinearCurve whitelisted:", LINEAR_CURVE);
            
            factory.setBondingCurveAllowed(ICurve(EXPONENTIAL_CURVE), true);
            console.log("  ExponentialCurve whitelisted:", EXPONENTIAL_CURVE);
            
            factory.setBondingCurveAllowed(ICurve(XYK_CURVE), true);
            console.log("  XYKCurve whitelisted:", XYK_CURVE);
            
            factory.setBondingCurveAllowed(ICurve(GDA_CURVE), true);
            console.log("  GDACurve whitelisted:", GDA_CURVE);
            
            console.log("Whitelisting router...");
            factory.setRouterAllowed(LSSVMRouter(payable(address(router))), true);
            console.log("  Router whitelisted:", address(router));
            
            console.log("Configuration complete!");
        } else {
            console.log("WARNING: Deployer is not factory owner. Manual configuration required.");
            console.log("  Deployer:", deployer);
            console.log("  Factory Owner:", factoryOwner);
            console.log("  Actual Factory Owner:", actualOwner);
            console.log("\nManual configuration commands:");
            console.log("  factory.setBondingCurveAllowed(0xe41352CB8D9af18231E05520751840559C2a548A, true)");
            console.log("  factory.setBondingCurveAllowed(0x9506C0E5CEe9AD1dEe65B3539268D61CCB25aFB6, true)");
            console.log("  factory.setBondingCurveAllowed(0xd0A2f4ae5E816ec09374c67F6532063B60dE037B, true)");
            console.log("  factory.setBondingCurveAllowed(0x4f1627be4C72aEB9565D4c751550C4D262a96B51, true)");
            console.log("  factory.setRouterAllowed(", address(router), ", true)");
        }
    }

    function printSummary() internal view {
        console.log("\n");
        console.log("==========================================================");
        console.log("            DEPLOYMENT SUMMARY (Base Mainnet)");
        console.log("==========================================================");
        console.log("");
        console.log("Core Contracts:");
        console.log("  RoyaltyEngine:           ", address(royaltyEngine));
        console.log("  LSSVMPairERC721ETH:      ", address(erc721ETHTemplate));
        console.log("  LSSVMPairERC721ERC20:    ", address(erc721ERC20Template));
        console.log("  LSSVMPairERC1155ETH:     ", address(erc1155ETHTemplate));
        console.log("  LSSVMPairERC1155ERC20:   ", address(erc1155ERC20Template));
        console.log("  LSSVMPairFactory:        ", address(factory));
        console.log("");
        console.log("Router:");
        console.log("  VeryFastRouter:          ", address(router));
        console.log("");
        console.log("Bonding Curves (Base Mainnet):");
        console.log("  LinearCurve:             ", LINEAR_CURVE);
        console.log("  ExponentialCurve:        ", EXPONENTIAL_CURVE);
        console.log("  XykCurve:                ", XYK_CURVE);
        console.log("  GDACurve:                ", GDA_CURVE);
        console.log("");
        console.log("==========================================================");
        console.log("\nNext Steps:");
        console.log("1. Update apps/miniapp/.env.local with:");
        console.log("   NEXT_PUBLIC_FACTORY_ADDRESS_8453=", address(factory));
        console.log("   NEXT_PUBLIC_ROUTER_ADDRESS_8453=", address(router));
        console.log("2. Verify contracts on BaseScan if using --verify flag");
        console.log("==========================================================");
    }
}

