// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewardToken is ERC20 {
    address public immutable owner;

    // By default, ERC20 uses 18 decimals.
    // initialSupply should be the raw amount (e.g., 1_000_000 * 10**18)
    constructor(uint256 initialSupply) ERC20("AdRewardToken", "ART") {
        require(initialSupply > 0, "Initial supply must be greater than 0");

        owner = msg.sender;
        _mint(msg.sender, initialSupply);
    }
}
