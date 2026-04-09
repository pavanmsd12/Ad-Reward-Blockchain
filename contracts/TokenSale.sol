// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenSale is ReentrancyGuard {
    address public owner;
    IERC20 public immutable rewardToken;

    uint256 public tokensPerEth;

    event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensReceived);
    event TokensSold(address indexed seller, uint256 tokensSold, uint256 ethReturned);
    event RateUpdated(uint256 newRate);
    event EthWithdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address tokenAddress, uint256 initialRate) {
        require(tokenAddress != address(0), "Invalid token address");
        require(initialRate > 0, "Rate must be greater than 0");

        owner = msg.sender;
        rewardToken = IERC20(tokenAddress);
        tokensPerEth = initialRate;
    }

    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be greater than 0");
        tokensPerEth = newRate;

        emit RateUpdated(newRate);
    }

    function buyTokens() external payable nonReentrant {
        _buyTokens(msg.sender, msg.value);
    }

    function _buyTokens(address buyer, uint256 ethAmount) internal {
        require(ethAmount > 0, "Send ETH to buy tokens");

        // Since both ETH and ART have 18 decimals, 1 ETH = tokensPerEth ART tokens.
        uint256 tokenAmount = (ethAmount * tokensPerEth);
        require(tokenAmount > 0, "ETH amount too low");

        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance >= tokenAmount, "Not enough tokens in sale contract");

        bool success = rewardToken.transfer(buyer, tokenAmount);
        require(success, "Token transfer failed");

        emit TokensPurchased(buyer, ethAmount, tokenAmount);
    }

    function sellTokens(uint256 tokenAmount) external nonReentrant {
        require(tokenAmount > 0, "Token amount must be greater than 0");

        uint256 ethAmount = tokenAmount / tokensPerEth;
        require(ethAmount > 0, "Token amount too low");
        require(address(this).balance >= ethAmount, "Not enough ETH in sale contract");

        bool success = rewardToken.transferFrom(msg.sender, address(this), tokenAmount);
        require(success, "Token transfer failed");

        (bool sent, ) = msg.sender.call{value: ethAmount}("");
        require(sent, "Failed to send Ether");

        emit TokensSold(msg.sender, tokenAmount, ethAmount);
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough ETH");

        (bool sent, ) = owner.call{value: amount}("");
        require(sent, "Failed to send Ether");

        emit EthWithdrawn(owner, amount);
    }

    function getSaleTokenBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    function getSaleEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable nonReentrant {
        _buyTokens(msg.sender, msg.value);
    }
}
