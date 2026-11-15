// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/property-checking/MerklePropertyChecker.sol";
import "../src/property-checking/RangePropertyChecker.sol";
import "../src/property-checking/PropertyCheckerFactory.sol";

/**
 * @title Property Checker Deployment Script
 * @notice Deploys property checker contracts
 * @dev This script deploys:
 *      1. MerklePropertyChecker (implementation)
 *      2. RangePropertyChecker (implementation)
 *      3. PropertyCheckerFactory
 * 
 * Property checkers allow pools to verify on-chain that NFTs meet specific criteria
 * (e.g., ID ranges, merkle tree inclusion) before accepting them in swaps.
 * 
 * The factory creates clones of the implementations with specific parameters.
 * 
 * Usage:
 *      forge script script/04_DeployPropertyCheckers.s.sol:DeployPropertyCheckers --rpc-url <your_rpc_url> --broadcast --verify
 */
contract DeployPropertyCheckers is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy property checker implementations
        console.log("Deploying Property Checker implementations...");
        
        MerklePropertyChecker merkleChecker = new MerklePropertyChecker();
        console.log("MerklePropertyChecker implementation deployed at:", address(merkleChecker));
        
        RangePropertyChecker rangeChecker = new RangePropertyChecker();
        console.log("RangePropertyChecker implementation deployed at:", address(rangeChecker));

        // Deploy PropertyCheckerFactory
        console.log("\nDeploying PropertyCheckerFactory...");
        PropertyCheckerFactory factory = new PropertyCheckerFactory(
            merkleChecker,
            rangeChecker
        );
        console.log("PropertyCheckerFactory deployed at:", address(factory));

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("MerklePropertyChecker:", address(merkleChecker));
        console.log("RangePropertyChecker:", address(rangeChecker));
        console.log("PropertyCheckerFactory:", address(factory));
        
        console.log("\n=== Usage ===");
        console.log("To create a MerklePropertyChecker instance:");
        console.log("  factory.createMerklePropertyChecker(bytes32 merkleRoot)");
        console.log("\nTo create a RangePropertyChecker instance:");
        console.log("  factory.createRangePropertyChecker(uint256 startInclusive, uint256 endInclusive)");
    }
}
