// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/bonding-curves/LinearCurve.sol";
import "../src/bonding-curves/ExponentialCurve.sol";
import "../src/bonding-curves/XykCurve.sol";
import "../src/bonding-curves/GDACurve.sol";

/**
 * @title Bonding Curves Deployment Script
 * @notice Deploys all bonding curve contracts
 * @dev This script deploys:
 *      1. LinearCurve
 *      2. ExponentialCurve
 *      3. XykCurve (x*y=k curve)
 *      4. GDACurve (Gradual Dutch Auction curve)
 * 
 * These curves are standalone contracts with no dependencies.
 * After deployment, they must be whitelisted in the LSSVMPairFactory
 * by calling setBondingCurveAllowed(curve, true) for each curve.
 * 
 * Usage:
 *      forge script script/02_DeployBondingCurves.s.sol:DeployBondingCurves --rpc-url <your_rpc_url> --broadcast --verify
 */
contract DeployBondingCurves is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy all bonding curves
        console.log("Deploying Bonding Curves...");
        
        LinearCurve linearCurve = new LinearCurve();
        console.log("LinearCurve deployed at:", address(linearCurve));
        
        ExponentialCurve exponentialCurve = new ExponentialCurve();
        console.log("ExponentialCurve deployed at:", address(exponentialCurve));
        
        XykCurve xykCurve = new XykCurve();
        console.log("XykCurve deployed at:", address(xykCurve));
        
        GDACurve gdaCurve = new GDACurve();
        console.log("GDACurve deployed at:", address(gdaCurve));

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("LinearCurve:", address(linearCurve));
        console.log("ExponentialCurve:", address(exponentialCurve));
        console.log("XykCurve:", address(xykCurve));
        console.log("GDACurve:", address(gdaCurve));
        
        console.log("\n=== Post-Deployment Steps ===");
        console.log("1. Whitelist curves in LSSVMPairFactory by calling:");
        console.log("   factory.setBondingCurveAllowed(address(linearCurve), true)");
        console.log("   factory.setBondingCurveAllowed(address(exponentialCurve), true)");
        console.log("   factory.setBondingCurveAllowed(address(xykCurve), true)");
        console.log("   factory.setBondingCurveAllowed(address(gdaCurve), true)");
    }
}
