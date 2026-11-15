// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/mocks/TestNFT721.sol";
import "../src/mocks/TestNFT1155.sol";

/**
 * @title Deploy Test NFTs
 * @notice Deploys test NFT contracts for testing pools:
 *         - TestNFT721: ERC721 with 100 pre-minted tokens (IDs 0-99)
 *         - TestNFT1155: ERC1155 with:
 *           - Item 0: 10 copies
 *           - Item 1: 1000 copies
 * 
 * Usage:
 *      forge script script/DeployTestNFTs.s.sol:DeployTestNFTs --rpc-url $RPC_URL --broadcast
 */
contract DeployTestNFTs is Script {
    function run() external {
        vm.startBroadcast();

        console.log("=== Deploying Test NFTs ===");
        console.log("");

        // Deploy ERC721 with 100 tokens
        console.log("Deploying TestNFT721 (100 tokens)...");
        TestNFT721 nft721 = new TestNFT721();
        console.log("TestNFT721 deployed at:", address(nft721));
        console.log("Total supply:", nft721.TOTAL_SUPPLY());
        console.log("All tokens minted to deployer:", tx.origin);
        console.log("");

        // Deploy ERC1155 with pre-minted items
        console.log("Deploying TestNFT1155...");
        TestNFT1155 nft1155 = new TestNFT1155();
        console.log("TestNFT1155 deployed at:", address(nft1155));
        console.log("Item 0 (ID 0):", nft1155.ITEM_0_SUPPLY(), "copies");
        console.log("Item 1 (ID 1):", nft1155.ITEM_1_SUPPLY(), "copies");
        console.log("All items minted to deployer:", tx.origin);
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("==========================================================");
        console.log("            TEST NFT DEPLOYMENT SUMMARY");
        console.log("==========================================================");
        console.log("");
        console.log("ERC721:");
        console.log("  Contract: TestNFT721");
        console.log("  Address:", address(nft721));
        console.log("  Total Supply: 100 tokens (IDs 0-99)");
        console.log("  Owner:", tx.origin);
        console.log("");
        console.log("ERC1155:");
        console.log("  Contract: TestNFT1155");
        console.log("  Address:", address(nft1155));
        console.log("  Item 0 (ID 0): 10 copies");
        console.log("  Item 1 (ID 1): 1000 copies");
        console.log("  Owner:", tx.origin);
        console.log("");
        console.log("==========================================================");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Use these contracts to test pool creation:");
        console.log("   - Create ERC721/ETH pools with TestNFT721");
        console.log("   - Create ERC1155/ETH pools with TestNFT1155");
        console.log("2. Transfer tokens to test users as needed");
        console.log("==========================================================");
    }
}

