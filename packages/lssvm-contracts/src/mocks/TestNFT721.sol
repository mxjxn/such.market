// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestNFT721
 * @notice A simple ERC721 contract for testing with 100 pre-minted tokens (IDs 0-99)
 * @dev All tokens are minted to the deployer in the constructor
 */
contract TestNFT721 is ERC721, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100;
    
    constructor() ERC721("Test NFT 721", "TN721") Ownable(msg.sender) {
        // Mint all 100 tokens to the deployer
        for (uint256 i = 0; i < TOTAL_SUPPLY; i++) {
            _mint(msg.sender, i);
        }
    }

    /**
     * @notice Mint additional tokens (beyond the initial 100)
     * @param to Address to mint to
     * @param id Token ID to mint
     */
    function mint(address to, uint256 id) public onlyOwner {
        _mint(to, id);
    }

    /**
     * @notice Batch mint multiple tokens
     * @param to Address to mint to
     * @param ids Array of token IDs to mint
     */
    function batchMint(address to, uint256[] calldata ids) public onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            _mint(to, ids[i]);
        }
    }
}

