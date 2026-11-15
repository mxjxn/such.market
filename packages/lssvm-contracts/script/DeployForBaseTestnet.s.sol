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

// Bonding curves
import "../src/bonding-curves/LinearCurve.sol";
import "../src/bonding-curves/ExponentialCurve.sol";
import "../src/bonding-curves/XykCurve.sol";
import "../src/bonding-curves/GDACurve.sol";

/**
 * @title Base Testnet (Sepolia) Deployment Script
 * @notice Deploys factory, router, and bonding curve contracts to Base Sepolia testnet
 * @dev This script deploys:
 *      1. Bonding Curves (LinearCurve, ExponentialCurve, XykCurve, GDACurve)
 *      2. RoyaltyEngine
 *      3. Pair Templates (ERC721ETH, ERC721ERC20, ERC1155ETH, ERC1155ERC20)
 *      4. LSSVMPairFactory
 *      5. VeryFastRouter
 * 
 *      It then whitelists all bonding curves and the router in the factory.
 * 
 * Required environment variables:
 *      - ROYALTY_REGISTRY: Address of the Manifold Royalty Registry for Base Sepolia
 *      - PROTOCOL_FEE_RECIPIENT: Address to receive protocol fees
 *      - PROTOCOL_FEE_MULTIPLIER: Protocol fee multiplier (in base 1e18, max 0.1e18 = 10%)
 *      - FACTORY_OWNER: Address that will own the factory contract
 * 
 * Optional environment variables:
 *      - DEPLOY_BONDING_CURVES: Set to "true" to deploy bonding curves (default: true)
 *      - LINEAR_CURVE_ADDRESS: Use existing LinearCurve address (if DEPLOY_BONDING_CURVES=false)
 *      - EXPONENTIAL_CURVE_ADDRESS: Use existing ExponentialCurve address
 *      - XYK_CURVE_ADDRESS: Use existing XykCurve address
 *      - GDA_CURVE_ADDRESS: Use existing GDACurve address
 * 
 * Usage:
 *      forge script script/DeployForBaseTestnet.s.sol:DeployForBaseTestnet --rpc-url $RPC_URL --broadcast --verify
 */
contract DeployForBaseTestnet is Script {
    // Deployment state
    LinearCurve public linearCurve;
    ExponentialCurve public exponentialCurve;
    XykCurve public xykCurve;
    GDACurve public gdaCurve;
    RoyaltyEngine public royaltyEngine;
    LSSVMPairERC721ETH public erc721ETHTemplate;
    LSSVMPairERC721ERC20 public erc721ERC20Template;
    LSSVMPairERC1155ETH public erc1155ETHTemplate;
    LSSVMPairERC1155ERC20 public erc1155ERC20Template;
    LSSVMPairFactory public factory;
    VeryFastRouter public router;

    function run() external {
        // Load configuration from environment variables
        address royaltyRegistry = vm.envAddress("ROYALTY_REGISTRY");
        address payable protocolFeeRecipient = payable(vm.envAddress("PROTOCOL_FEE_RECIPIENT"));
        uint256 protocolFeeMultiplier = vm.envUint("PROTOCOL_FEE_MULTIPLIER");
        address factoryOwner = vm.envAddress("FACTORY_OWNER");

        vm.startBroadcast();

        // ===== STEP 1: Deploy Bonding Curves =====
        console.log("=== STEP 1: Deploying Bonding Curves ===");
        deployBondingCurves();

        // ===== STEP 2: Deploy Core Contracts =====
        console.log("\n=== STEP 2: Deploying Core Contracts ===");
        deployCore(royaltyRegistry, protocolFeeRecipient, protocolFeeMultiplier, factoryOwner);

        // ===== STEP 3: Deploy Router =====
        console.log("\n=== STEP 3: Deploying Router ===");
        deployRouter();

        // ===== STEP 4: Configure Factory =====
        console.log("\n=== STEP 4: Configuring Factory ===");
        configureFactory();

        vm.stopBroadcast();

        // Print deployment summary
        printSummary();
    }

    function deployBondingCurves() internal {
        // Check if we should deploy bonding curves or use existing addresses
        bool deployCurves = true;
        try vm.envBool("DEPLOY_BONDING_CURVES") returns (bool val) {
            deployCurves = val;
        } catch {}

        if (deployCurves) {
            console.log("Deploying new bonding curves...");
            linearCurve = new LinearCurve();
            console.log("LinearCurve:", address(linearCurve));
            
            exponentialCurve = new ExponentialCurve();
            console.log("ExponentialCurve:", address(exponentialCurve));
            
            xykCurve = new XykCurve();
            console.log("XykCurve:", address(xykCurve));
            
            gdaCurve = new GDACurve();
            console.log("GDACurve:", address(gdaCurve));
        } else {
            console.log("Using existing bonding curve addresses...");
            address linearCurveAddr = vm.envAddress("LINEAR_CURVE_ADDRESS");
            address exponentialCurveAddr = vm.envAddress("EXPONENTIAL_CURVE_ADDRESS");
            address xykCurveAddr = vm.envAddress("XYK_CURVE_ADDRESS");
            address gdaCurveAddr = vm.envAddress("GDA_CURVE_ADDRESS");
            
            // Cast to contract types (we won't use them directly, just store addresses)
            linearCurve = LinearCurve(linearCurveAddr);
            exponentialCurve = ExponentialCurve(exponentialCurveAddr);
            xykCurve = XykCurve(xykCurveAddr);
            gdaCurve = GDACurve(gdaCurveAddr);
            
            console.log("LinearCurve:", address(linearCurve));
            console.log("ExponentialCurve:", address(exponentialCurve));
            console.log("XykCurve:", address(xykCurve));
            console.log("GDACurve:", address(gdaCurve));
        }
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
        address deployer = tx.origin;
        
        // Fallback: verify factory's actual owner matches expected owner
        address actualOwner = factory.owner();
        bool shouldConfigure = (deployer == factoryOwner) || (actualOwner == factoryOwner);
        
        if (shouldConfigure) {
            console.log("Whitelisting bonding curves...");
            factory.setBondingCurveAllowed(ICurve(address(linearCurve)), true);
            console.log("  LinearCurve whitelisted:", address(linearCurve));
            
            factory.setBondingCurveAllowed(ICurve(address(exponentialCurve)), true);
            console.log("  ExponentialCurve whitelisted:", address(exponentialCurve));
            
            factory.setBondingCurveAllowed(ICurve(address(xykCurve)), true);
            console.log("  XykCurve whitelisted:", address(xykCurve));
            
            factory.setBondingCurveAllowed(ICurve(address(gdaCurve)), true);
            console.log("  GDACurve whitelisted:", address(gdaCurve));
            
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
            console.log("  factory.setBondingCurveAllowed(", address(linearCurve), ", true)");
            console.log("  factory.setBondingCurveAllowed(", address(exponentialCurve), ", true)");
            console.log("  factory.setBondingCurveAllowed(", address(xykCurve), ", true)");
            console.log("  factory.setBondingCurveAllowed(", address(gdaCurve), ", true)");
            console.log("  factory.setRouterAllowed(", address(router), ", true)");
        }
    }

    function printSummary() internal view {
        console.log("\n");
        console.log("==========================================================");
        console.log("      DEPLOYMENT SUMMARY (Base Sepolia Testnet)");
        console.log("==========================================================");
        console.log("");
        console.log("Bonding Curves:");
        console.log("  LinearCurve:             ", address(linearCurve));
        console.log("  ExponentialCurve:        ", address(exponentialCurve));
        console.log("  XykCurve:                ", address(xykCurve));
        console.log("  GDACurve:                ", address(gdaCurve));
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
        console.log("==========================================================");
        console.log("\nNext Steps:");
        console.log("1. Update apps/miniapp/.env.local with:");
        console.log("   NEXT_PUBLIC_FACTORY_ADDRESS_84532=", address(factory));
        console.log("   NEXT_PUBLIC_ROUTER_ADDRESS_84532=", address(router));
        console.log("2. Verify contracts on BaseScan Sepolia if using --verify flag");
        console.log("3. Get testnet ETH from Base Sepolia faucet if needed");
        console.log("==========================================================");
    }
}

