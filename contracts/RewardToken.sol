// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RewardToken {
    string public constant name = "AdRewardToken";
    string public constant symbol = "ART";
    uint8 public constant decimals = 0;

    uint256 public totalSupply;
    address public immutable owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 value);

    constructor(uint256 initialSupply) {
        require(initialSupply > 0, "Initial supply must be greater than 0");

        owner = msg.sender;
        totalSupply = initialSupply;
        balanceOf[owner] = initialSupply;

        emit Transfer(address(0), owner, initialSupply);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[msg.sender] >= amount, "Not enough tokens");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        require(spender != address(0), "Invalid spender");

        allowance[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(from != address(0), "Invalid sender");
        require(to != address(0), "Invalid recipient");
        require(balanceOf[from] >= amount, "Not enough balance");
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");

        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }
}
