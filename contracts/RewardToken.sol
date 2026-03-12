// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RewardToken {

    string public name = "AdRewardToken";
    string public symbol = "ART";

    uint public totalSupply;

    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    address public owner;

    constructor(uint _initialSupply) {
        owner = msg.sender;
        totalSupply = _initialSupply;
        balanceOf[owner] = totalSupply;
    }

    function transfer(address _to, uint _amount) public returns (bool) {

        require(balanceOf[msg.sender] >= _amount, "Not enough tokens");

        balanceOf[msg.sender] -= _amount;
        balanceOf[_to] += _amount;

        return true;
    }

    function approve(address _spender, uint _amount) public returns (bool) {

        allowance[msg.sender][_spender] = _amount;

        return true;
    }

    function transferFrom(address _from, address _to, uint _amount) public returns (bool) {

        require(balanceOf[_from] >= _amount, "Not enough balance");

        require(allowance[_from][msg.sender] >= _amount, "Allowance exceeded");

        allowance[_from][msg.sender] -= _amount;

        balanceOf[_from] -= _amount;
        balanceOf[_to] += _amount;

        return true;
    }
}