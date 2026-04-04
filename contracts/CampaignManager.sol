// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRewardToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract CampaignManager {
    struct Campaign {
        address advertiser;
        string adName;
        string videoUrl;
        uint256 rewardPerView;
        uint256 remainingBudget;
        bool active;
    }

    address public owner;
    address public interactionContract;
    IRewardToken public immutable rewardToken;
    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed advertiser,
        string adName,
        string videoUrl,
        uint256 rewardPerView,
        uint256 budget
    );

    event CampaignStatusChanged(uint256 indexed campaignId, bool active);
    event RewardReleased(uint256 indexed campaignId, address indexed user, uint256 reward);
    event BudgetWithdrawn(uint256 indexed campaignId, address indexed advertiser, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyInteractionContract() {
        require(msg.sender == interactionContract, "Only interaction contract");
        _;
    }

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Invalid token address");
        owner = msg.sender;
        rewardToken = IRewardToken(tokenAddress);
    }

    function setInteractionContract(address interactionAddress) external onlyOwner {
        require(interactionAddress != address(0), "Invalid interaction address");
        interactionContract = interactionAddress;
    }

    function createCampaign(
        string memory adName,
        string memory videoUrl,
        uint256 rewardPerView,
        uint256 budget
    ) external {
        require(bytes(adName).length > 0, "Ad name required");
        require(bytes(videoUrl).length > 0, "Video URL required");
        require(rewardPerView > 0, "Reward must be > 0");
        require(budget >= rewardPerView, "Budget too low");

        bool success = rewardToken.transferFrom(msg.sender, address(this), budget);
        require(success, "Funding failed");

        campaignCount += 1;

        campaigns[campaignCount] = Campaign({
            advertiser: msg.sender,
            adName: adName,
            videoUrl: videoUrl,
            rewardPerView: rewardPerView,
            remainingBudget: budget,
            active: true
        });

        emit CampaignCreated(
            campaignCount,
            msg.sender,
            adName,
            videoUrl,
            rewardPerView,
            budget
        );
    }

    function setCampaignActive(uint256 campaignId, bool active) external {
        Campaign storage campaign = campaigns[campaignId];

        require(campaignId > 0 && campaignId <= campaignCount, "Invalid campaign");
        require(msg.sender == campaign.advertiser, "Only advertiser");

        campaign.active = active;
        emit CampaignStatusChanged(campaignId, active);
    }

    function withdrawRemainingBudget(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];

        require(campaignId > 0 && campaignId <= campaignCount, "Invalid campaign");
        require(msg.sender == campaign.advertiser, "Only advertiser");
        require(!campaign.active, "Deactivate campaign first");
        require(campaign.remainingBudget > 0, "No remaining budget");

        uint256 amount = campaign.remainingBudget;
        campaign.remainingBudget = 0;

        bool success = rewardToken.transfer(msg.sender, amount);
        require(success, "Withdraw failed");

        emit BudgetWithdrawn(campaignId, msg.sender, amount);
    }

    function releaseReward(uint256 campaignId, address user) external onlyInteractionContract {
        Campaign storage campaign = campaigns[campaignId];

        require(campaignId > 0 && campaignId <= campaignCount, "Invalid campaign");
        require(campaign.active, "Campaign inactive");
        require(campaign.remainingBudget >= campaign.rewardPerView, "Budget exhausted");

        campaign.remainingBudget -= campaign.rewardPerView;

        if (campaign.remainingBudget < campaign.rewardPerView) {
            campaign.active = false;
            emit CampaignStatusChanged(campaignId, false);
        }

        bool success = rewardToken.transfer(user, campaign.rewardPerView);
        require(success, "Reward transfer failed");

        emit RewardReleased(campaignId, user, campaign.rewardPerView);
    }

    function getCampaign(uint256 campaignId) external view returns (
        address advertiser,
        string memory adName,
        string memory videoUrl,
        uint256 rewardPerView,
        uint256 remainingBudget,
        bool active
    ) {
        Campaign memory campaign = campaigns[campaignId];
        return (
            campaign.advertiser,
            campaign.adName,
            campaign.videoUrl,
            campaign.rewardPerView,
            campaign.remainingBudget,
            campaign.active
        );
    }
}
