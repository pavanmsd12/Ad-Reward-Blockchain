// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICampaignManager {
    function getCampaign(uint256 campaignId) external view returns (
        address advertiser,
        string memory adName,
        string memory videoUrl,
        uint256 rewardPerView,
        uint256 remainingBudget,
        bool active
    );

    function releaseReward(uint256 campaignId, address user) external;
}

contract AdInteraction {
    address public owner;
    ICampaignManager public immutable campaignManager;

    mapping(address => mapping(uint256 => bool)) public hasClaimed;

    event AdClaimed(address indexed user, uint256 indexed campaignId, uint256 reward);

    constructor(address campaignManagerAddress) {
        require(campaignManagerAddress != address(0), "Invalid campaign manager");
        owner = msg.sender;
        campaignManager = ICampaignManager(campaignManagerAddress);
    }

    function claimReward(uint256 campaignId) external {
        (
            address advertiser,
            ,
            ,
            uint256 rewardPerView,
            uint256 remainingBudget,
            bool active
        ) = campaignManager.getCampaign(campaignId);

        require(advertiser != address(0), "Invalid campaign");
        require(active, "Campaign inactive");
        require(msg.sender != advertiser, "Advertiser cannot claim");
        require(!hasClaimed[msg.sender][campaignId], "Already claimed");
        require(remainingBudget >= rewardPerView, "Budget exhausted");

        hasClaimed[msg.sender][campaignId] = true;

        campaignManager.releaseReward(campaignId, msg.sender);

        emit AdClaimed(msg.sender, campaignId, rewardPerView);
    }
}
