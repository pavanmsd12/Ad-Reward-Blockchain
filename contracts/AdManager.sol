// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardToken {
    function transfer(address _to, uint _amount) external;
}

contract AdManager {
event CampaignCreated(uint campaignId, string adName, uint reward);
    address public owner;
    IRewardToken public rewardToken;

    struct Campaign {
        string adName;
        uint reward;
        bool active;
    }

    uint public campaignCount;

    mapping(uint => Campaign) public campaigns;
    mapping(address => mapping(uint => bool)) public hasClaimed;

    constructor(address _tokenAddress) {
        owner = msg.sender;
        rewardToken = IRewardToken(_tokenAddress);
    }

    function createCampaign(string memory _adName, uint _reward) public {
        require(msg.sender == owner, "Only owner");

        campaignCount++;

        campaigns[campaignCount] = Campaign({
            adName: _adName,
            reward: _reward,
            active: true
        });
        emit CampaignCreated(campaignCount, _adName, _reward);
    }

    function watchAd(uint campaignId) public {

        Campaign memory campaign = campaigns[campaignId];

        require(campaign.active, "Campaign inactive");
        require(!hasClaimed[msg.sender][campaignId], "Already rewarded");

        hasClaimed[msg.sender][campaignId] = true;

        rewardToken.transfer(msg.sender, campaign.reward);
    }
}