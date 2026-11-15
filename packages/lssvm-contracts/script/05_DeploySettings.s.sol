// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/settings/Splitter.sol";
import "../src/settings/StandardSettings.sol";
import "../src/settings/StandardSettingsFactory.sol";
import "../src/ILSSVMPairFactoryLike.sol";

/**
 * @title Settings Deployment Script
 * @notice Deploys settings-related contracts
 * @dev This script deploys:
 *      1. Splitter (implementation)
 *      2. StandardSettings (implementation)
 *      3. StandardSettingsFactory
 * 
 * Settings are an opt-in feature that allows project owners to enforce specific
 * requirements on pools (e.g., lock duration, fee splits) in exchange for
 * reduced royalties or other benefits.
 * 
 * Required environment variables:
 *      - FACTORY_ADDRESS: Address of the deployed LSSVMPairFactory
 * 
 * Usage:
 *      forge script script/05_DeploySettings.s.sol:DeploySettings --rpc-url <your_rpc_url> --broadcast --verify
 */
contract DeploySettings is Script {
    function run() external {
        // Load factory address from environment
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        
        vm.startBroadcast();

        // Deploy Splitter implementation
        console.log("Deploying Splitter implementation...");
        Splitter splitter = new Splitter();
        console.log("Splitter implementation deployed at:", address(splitter));

        // Deploy StandardSettings implementation
        console.log("\nDeploying StandardSettings implementation...");
        StandardSettings standardSettings = new StandardSettings(
            splitter,
            ILSSVMPairFactoryLike(factoryAddress)
        );
        console.log("StandardSettings implementation deployed at:", address(standardSettings));

        // Deploy StandardSettingsFactory
        console.log("\nDeploying StandardSettingsFactory...");
        StandardSettingsFactory settingsFactory = new StandardSettingsFactory(standardSettings);
        console.log("StandardSettingsFactory deployed at:", address(settingsFactory));

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("Splitter:", address(splitter));
        console.log("StandardSettings:", address(standardSettings));
        console.log("StandardSettingsFactory:", address(settingsFactory));
        console.log("Factory:", factoryAddress);
        
        console.log("\n=== Usage ===");
        console.log("To create a StandardSettings instance, call:");
        console.log("  settingsFactory.createSettings(");
        console.log("    address payable settingsFeeRecipient,");
        console.log("    uint256 ethCost,");
        console.log("    uint64 secDuration,");
        console.log("    uint64 feeSplitBps,");
        console.log("    uint64 royaltyBps");
        console.log("  )");
        console.log("\nConstraints:");
        console.log("  - royaltyBps <= 1000 (10%)");
        console.log("  - feeSplitBps <= 10000 (100%)");
        console.log("  - secDuration <= 31,556,926 (1 year)");
    }
}
