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

// Bonding curves
import "../src/bonding-curves/ICurve.sol";
import "../src/bonding-curves/LinearCurve.sol";
import "../src/bonding-curves/ExponentialCurve.sol";
import "../src/bonding-curves/XykCurve.sol";
import "../src/bonding-curves/GDACurve.sol";

// Router
import "../src/LSSVMRouter.sol";
import "../src/VeryFastRouter.sol";

// Property checkers
import "../src/property-checking/MerklePropertyChecker.sol";
import "../src/property-checking/RangePropertyChecker.sol";
import "../src/property-checking/PropertyCheckerFactory.sol";

// Settings
import "../src/settings/Splitter.sol";
import "../src/settings/StandardSettings.sol";
import "../src/settings/StandardSettingsFactory.sol";

/**
 * @title Master Deployment Script
 * @notice Deploys all sudoAMM v2 contracts in the correct order
 * @dev This script performs a complete deployment of the entire protocol:
 *      1. Core contracts (RoyaltyEngine, Templates, Factory)
 *      2. Bonding curves
 *      3. Router
 *      4. Property checkers
 *      5. Settings
 * 
 * Required environment variables:
 *      - ROYALTY_REGISTRY: Address of the Manifold Royalty Registry (chain-specific)
 *      - PROTOCOL_FEE_RECIPIENT: Address to receive protocol fees
 *      - PROTOCOL_FEE_MULTIPLIER: Protocol fee multiplier (in base 1e18, max 0.1e18 = 10%)
 *      - FACTORY_OWNER: Address that will own the factory contract
 * 
 * Usage:
 *      forge script script/DeployAll.s.sol:DeployAll --rpc-url <your_rpc_url> --broadcast --verify
 * 
 * Note: This script will deploy all contracts in a single transaction sequence.
 *       For production deployments, consider using individual scripts for better control.
 */
contract DeployAll is Script {
    // Deployment state
    RoyaltyEngine public royaltyEngine;
    LSSVMPairERC721ETH public erc721ETHTemplate;
    LSSVMPairERC721ERC20 public erc721ERC20Template;
    LSSVMPairERC1155ETH public erc1155ETHTemplate;
    LSSVMPairERC1155ERC20 public erc1155ERC20Template;
    LSSVMPairFactory public factory;
    
    LinearCurve public linearCurve;
    ExponentialCurve public exponentialCurve;
    XykCurve public xykCurve;
    GDACurve public gdaCurve;
    
    VeryFastRouter public router;
    
    MerklePropertyChecker public merkleChecker;
    RangePropertyChecker public rangeChecker;
    PropertyCheckerFactory public propertyCheckerFactory;
    
    Splitter public splitter;
    StandardSettings public standardSettings;
    StandardSettingsFactory public settingsFactory;

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

        // ===== STEP 2: Deploy Bonding Curves =====
        console.log("\n=== STEP 2: Deploying Bonding Curves ===");
        deployBondingCurves();

        // ===== STEP 3: Deploy Router =====
        console.log("\n=== STEP 3: Deploying Router ===");
        deployRouter();

        // ===== STEP 4: Deploy Property Checkers =====
        console.log("\n=== STEP 4: Deploying Property Checkers ===");
        deployPropertyCheckers();

        // ===== STEP 5: Deploy Settings =====
        console.log("\n=== STEP 5: Deploying Settings ===");
        deploySettings();

        // ===== STEP 6: Configure Factory =====
        console.log("\n=== STEP 6: Configuring Factory ===");
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

    function deployBondingCurves() internal {
        linearCurve = new LinearCurve();
        console.log("LinearCurve:", address(linearCurve));
        
        exponentialCurve = new ExponentialCurve();
        console.log("ExponentialCurve:", address(exponentialCurve));
        
        xykCurve = new XykCurve();
        console.log("XykCurve:", address(xykCurve));
        
        gdaCurve = new GDACurve();
        console.log("GDACurve:", address(gdaCurve));
    }

    function deployRouter() internal {
        router = new VeryFastRouter(ILSSVMPairFactoryLike(address(factory)));
        console.log("VeryFastRouter:", address(router));
    }

    function deployPropertyCheckers() internal {
        merkleChecker = new MerklePropertyChecker();
        console.log("MerklePropertyChecker:", address(merkleChecker));
        
        rangeChecker = new RangePropertyChecker();
        console.log("RangePropertyChecker:", address(rangeChecker));
        
        propertyCheckerFactory = new PropertyCheckerFactory(merkleChecker, rangeChecker);
        console.log("PropertyCheckerFactory:", address(propertyCheckerFactory));
    }

    function deploySettings() internal {
        splitter = new Splitter();
        console.log("Splitter:", address(splitter));
        
        standardSettings = new StandardSettings(splitter, ILSSVMPairFactoryLike(address(factory)));
        console.log("StandardSettings:", address(standardSettings));
        
        settingsFactory = new StandardSettingsFactory(standardSettings);
        console.log("StandardSettingsFactory:", address(settingsFactory));
    }

    function configureFactory() internal {
        // Check if deployer is the factory owner
        address factoryOwner = vm.envAddress("FACTORY_OWNER");
        address deployer = tx.origin; // Use tx.origin for deployer address
        
        // Fallback: verify factory's actual owner matches expected owner
        address actualOwner = factory.owner();
        bool shouldConfigure = (deployer == factoryOwner) || (actualOwner == factoryOwner);
        
        if (shouldConfigure) {
            console.log("Whitelisting bonding curves...");
            factory.setBondingCurveAllowed(ICurve(address(linearCurve)), true);
            factory.setBondingCurveAllowed(ICurve(address(exponentialCurve)), true);
            factory.setBondingCurveAllowed(ICurve(address(xykCurve)), true);
            factory.setBondingCurveAllowed(ICurve(address(gdaCurve)), true);
            
            console.log("Whitelisting router...");
            factory.setRouterAllowed(LSSVMRouter(payable(address(router))), true);
            
            console.log("Configuration complete!");
        } else {
            console.log("WARNING: Deployer is not factory owner. Manual configuration required.");
            console.log("  Deployer:", deployer);
            console.log("  Factory Owner:", factoryOwner);
            console.log("  Actual Factory Owner:", actualOwner);
        }
    }

    function printSummary() internal view {
        console.log("\n");
        console.log("==========================================================");
        console.log("            DEPLOYMENT SUMMARY");
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
        console.log("Bonding Curves:");
        console.log("  LinearCurve:             ", address(linearCurve));
        console.log("  ExponentialCurve:        ", address(exponentialCurve));
        console.log("  XykCurve:                ", address(xykCurve));
        console.log("  GDACurve:                ", address(gdaCurve));
        console.log("");
        console.log("Router:");
        console.log("  VeryFastRouter:          ", address(router));
        console.log("");
        console.log("Property Checkers:");
        console.log("  MerklePropertyChecker:   ", address(merkleChecker));
        console.log("  RangePropertyChecker:    ", address(rangeChecker));
        console.log("  PropertyCheckerFactory:  ", address(propertyCheckerFactory));
        console.log("");
        console.log("Settings:");
        console.log("  Splitter:                ", address(splitter));
        console.log("  StandardSettings:        ", address(standardSettings));
        console.log("  StandardSettingsFactory: ", address(settingsFactory));
        console.log("");
        console.log("==========================================================");
    }
}
