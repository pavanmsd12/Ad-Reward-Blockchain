// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardToken {
    function transfer(address _to, uint _amount) external returns (bool);
    function transferFrom(address _from, address _to, uint _amount) external returns (bool);
}

contract AdManager {

    event CampaignCreated(uint campaignId, string adName, uint reward);
    event AdWatched(address user, uint campaignId, uint reward);

    address public owner;
    IRewardToken public rewardToken;

    struct Campaign {
        address advertiser;
        string adName;
        uint reward;
        uint remainingBudget;
        bool active;
    }

    uint public campaignCount;

    mapping(uint => Campaign) public campaigns;
    mapping(address => mapping(uint => bool)) public hasClaimed;

    constructor(address _tokenAddress) {
        owner = msg.sender;
        rewardToken = IRewardToken(_tokenAddress);
    }

    function createCampaign(
        string memory _adName,
        uint _reward,
        uint _budget
    ) public {

        require(_budget > 0, "Budget must be greater than 0");
        require(_reward > 0, "Reward must be greater than 0");

        // Advertiser deposits tokens for campaign
        bool success = rewardToken.transferFrom(msg.sender, address(this), _budget);
        require(success, "Token transfer failed");

        campaignCount++;

        campaigns[campaignCount] = Campaign({
            advertiser: msg.sender,
            adName: _adName,
            reward: _reward,
            remainingBudget: _budget,
            active: true
        });

        emit CampaignCreated(campaignCount, _adName, _reward);
    }

    function watchAd(uint campaignId) public {

        require(campaignId > 0 && campaignId <= campaignCount, "Invalid campaign");

        Campaign storage campaign = campaigns[campaignId];

        require(campaign.active, "Campaign inactive");
        require(!hasClaimed[msg.sender][campaignId], "Already rewarded");
        require(campaign.remainingBudget >= campaign.reward, "Budget exhausted");

        hasClaimed[msg.sender][campaignId] = true;

        campaign.remainingBudget -= campaign.reward;

        bool success = rewardToken.transfer(msg.sender, campaign.reward);
        require(success, "Reward transfer failed");

        emit AdWatched(msg.sender, campaignId, campaign.reward);
    }
}