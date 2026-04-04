// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TokenSale {
    address public owner;
    IRewardToken public immutable rewardToken;

    uint256 public tokensPerEth;

    event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensReceived);
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
        rewardToken = IRewardToken(tokenAddress);
        tokensPerEth = initialRate;
    }

    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be greater than 0");
        tokensPerEth = newRate;

        emit RateUpdated(newRate);
    }

    function buyTokens() external payable {
        _buyTokens(msg.sender, msg.value);
    }

    function _buyTokens(address buyer, uint256 ethAmount) internal {
        require(ethAmount > 0, "Send ETH to buy tokens");

        uint256 tokenAmount = (ethAmount * tokensPerEth) / 1 ether;
        require(tokenAmount > 0, "ETH amount too low");

        uint256 contractBalance = rewardToken.balanceOf(address(this));
        require(contractBalance >= tokenAmount, "Not enough tokens in sale contract");

        bool success = rewardToken.transfer(buyer, tokenAmount);
        require(success, "Token transfer failed");

        emit TokensPurchased(buyer, ethAmount, tokenAmount);
    }

    function withdrawEth(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough ETH");

        payable(owner).transfer(amount);

        emit EthWithdrawn(owner, amount);
    }

    function getSaleTokenBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    receive() external payable {
        _buyTokens(msg.sender, msg.value);
    }
}
