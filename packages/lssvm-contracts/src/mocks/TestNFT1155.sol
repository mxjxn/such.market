// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title TestNFT1155
 * @notice A simple ERC1155 contract for testing with pre-minted items:
 *         - Item 0: 10 copies
 *         - Item 1: 1000 copies
 * @dev All items are minted to the deployer in the constructor
 */
contract TestNFT1155 is ERC1155, Ownable {
    uint256 public constant ITEM_0_ID = 0;
    uint256 public constant ITEM_0_SUPPLY = 10;
    uint256 public constant ITEM_1_ID = 1;
    uint256 public constant ITEM_1_SUPPLY = 1000;
    
    constructor() ERC1155("Test NFT 1155") Ownable(msg.sender) {
        // Mint item 0: 10 copies to deployer
        _mint(msg.sender, ITEM_0_ID, ITEM_0_SUPPLY, "");
        
        // Mint item 1: 1000 copies to deployer
        _mint(msg.sender, ITEM_1_ID, ITEM_1_SUPPLY, "");
    }

    /**
     * @notice Mint additional copies of an item
     * @param to Address to mint to
     * @param id Item ID to mint
     * @param amount Number of copies to mint
     */
    function mint(address to, uint256 id, uint256 amount) public onlyOwner {
        _mint(to, id, amount, "");
    }

    /**
     * @notice Batch mint multiple items
     * @param to Address to mint to
     * @param ids Array of item IDs to mint
     * @param amounts Array of amounts to mint for each item
     */
    function batchMint(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) public onlyOwner {
        require(ids.length == amounts.length, "Arrays length mismatch");
        _mintBatch(to, ids, amounts, "");
    }
}

