// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RewardToken {

    string public name = "AdRewardToken";
    string public symbol = "ART";
    uint public totalSupply;

    mapping(address => uint) public balanceOf;

    address public owner;

    constructor(uint _initialSupply) {
        owner = msg.sender;
        totalSupply = _initialSupply;
        balanceOf[owner] = totalSupply;
    }

    function transfer(address _to, uint _amount) public {
        require(balanceOf[msg.sender] >= _amount, "Not enough tokens");

        balanceOf[msg.sender] -= _amount;
        balanceOf[_to] += _amount;
    }
}