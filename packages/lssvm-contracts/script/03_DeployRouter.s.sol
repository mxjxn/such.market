// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/VeryFastRouter.sol";
import "../src/ILSSVMPairFactoryLike.sol";

/**
 * @title Router Deployment Script
 * @notice Deploys the VeryFastRouter contract
 * @dev This script deploys:
 *      1. VeryFastRouter
 * 
 * The VeryFastRouter is a full-featured router that handles all swap types
 * (ERC721<>ETH, ERC721<>ERC20, ERC1155<>ETH, ERC1155<>ERC20) with partial fill support.
 * 
 * Required environment variables:
 *      - FACTORY_ADDRESS: Address of the deployed LSSVMPairFactory
 * 
 * Post-deployment:
 *      The router must be whitelisted in the factory by calling:
 *      factory.setRouterAllowed(router, true)
 * 
 * Usage:
 *      forge script script/03_DeployRouter.s.sol:DeployRouter --rpc-url <your_rpc_url> --broadcast --verify
 */
contract DeployRouter is Script {
    function run() external {
        // Load factory address from environment
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        
        vm.startBroadcast();

        // Deploy VeryFastRouter
        console.log("Deploying VeryFastRouter...");
        VeryFastRouter router = new VeryFastRouter(ILSSVMPairFactoryLike(factoryAddress));
        console.log("VeryFastRouter deployed at:", address(router));

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("VeryFastRouter:", address(router));
        console.log("Factory:", factoryAddress);
        
        console.log("\n=== Post-Deployment Steps ===");
        console.log("1. Whitelist router in LSSVMPairFactory by calling:");
        console.log("   factory.setRouterAllowed(", address(router), ", true)");
    }
}
