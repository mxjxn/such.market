// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/RoyaltyEngine.sol";
import "../src/erc721/LSSVMPairERC721ETH.sol";
import "../src/erc721/LSSVMPairERC721ERC20.sol";
import "../src/erc1155/LSSVMPairERC1155ETH.sol";
import "../src/erc1155/LSSVMPairERC1155ERC20.sol";
import "../src/LSSVMPairFactory.sol";

/**
 * @title Core Deployment Script
 * @notice Deploys the core sudoAMM v2 contracts in the correct order
 * @dev This script deploys:
 *      1. RoyaltyEngine
 *      2. Pair Templates (ERC721ETH, ERC721ERC20, ERC1155ETH, ERC1155ERC20)
 *      3. LSSVMPairFactory
 * 
 * Required environment variables:
 *      - ROYALTY_REGISTRY: Address of the Manifold Royalty Registry (chain-specific)
 *      - PROTOCOL_FEE_RECIPIENT: Address to receive protocol fees
 *      - PROTOCOL_FEE_MULTIPLIER: Protocol fee multiplier (in base 1e18, max 0.1e18 = 10%)
 *      - FACTORY_OWNER: Address that will own the factory contract
 * 
 * Usage:
 *      forge script script/01_DeployCore.s.sol:DeployCore --rpc-url <your_rpc_url> --broadcast --verify
 */
contract DeployCore is Script {
    function run() external {
        // Load configuration from environment variables
        address royaltyRegistry = vm.envAddress("ROYALTY_REGISTRY");
        address payable protocolFeeRecipient = payable(vm.envAddress("PROTOCOL_FEE_RECIPIENT"));
        uint256 protocolFeeMultiplier = vm.envUint("PROTOCOL_FEE_MULTIPLIER");
        address factoryOwner = vm.envAddress("FACTORY_OWNER");

        vm.startBroadcast();

        // Step 1: Deploy RoyaltyEngine
        console.log("Deploying RoyaltyEngine...");
        RoyaltyEngine royaltyEngine = new RoyaltyEngine(royaltyRegistry);
        console.log("RoyaltyEngine deployed at:", address(royaltyEngine));

        // Step 2: Deploy Pair Templates
        console.log("\nDeploying Pair Templates...");
        
        LSSVMPairERC721ETH erc721ETHTemplate = new LSSVMPairERC721ETH(royaltyEngine);
        console.log("LSSVMPairERC721ETH template deployed at:", address(erc721ETHTemplate));
        
        LSSVMPairERC721ERC20 erc721ERC20Template = new LSSVMPairERC721ERC20(royaltyEngine);
        console.log("LSSVMPairERC721ERC20 template deployed at:", address(erc721ERC20Template));
        
        LSSVMPairERC1155ETH erc1155ETHTemplate = new LSSVMPairERC1155ETH(royaltyEngine);
        console.log("LSSVMPairERC1155ETH template deployed at:", address(erc1155ETHTemplate));
        
        LSSVMPairERC1155ERC20 erc1155ERC20Template = new LSSVMPairERC1155ERC20(royaltyEngine);
        console.log("LSSVMPairERC1155ERC20 template deployed at:", address(erc1155ERC20Template));

        // Step 3: Deploy LSSVMPairFactory
        console.log("\nDeploying LSSVMPairFactory...");
        LSSVMPairFactory factory = new LSSVMPairFactory(
            erc721ETHTemplate,
            erc721ERC20Template,
            erc1155ETHTemplate,
            erc1155ERC20Template,
            protocolFeeRecipient,
            protocolFeeMultiplier,
            factoryOwner
        );
        console.log("LSSVMPairFactory deployed at:", address(factory));

        vm.stopBroadcast();

        // Summary
        console.log("\n=== Deployment Summary ===");
        console.log("RoyaltyEngine:", address(royaltyEngine));
        console.log("LSSVMPairERC721ETH:", address(erc721ETHTemplate));
        console.log("LSSVMPairERC721ERC20:", address(erc721ERC20Template));
        console.log("LSSVMPairERC1155ETH:", address(erc1155ETHTemplate));
        console.log("LSSVMPairERC1155ERC20:", address(erc1155ERC20Template));
        console.log("LSSVMPairFactory:", address(factory));
    }
}
