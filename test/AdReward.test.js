const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AdReward System", function () {
  let owner;
  let advertiser;
  let user;
  let otherUser;

  let rewardToken;
  let campaignManager;
  let adInteraction;
  let tokenSale;

  const initialSupply = 1_000_000;
  const saleSupply = 500_000;
  const tokensPerEth = 1000;
  const rewardPerView = 10;
  const budget = 1000;

  beforeEach(async function () {
    [owner, advertiser, user, otherUser] = await ethers.getSigners();

    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy(initialSupply);
    await rewardToken.waitForDeployment();

    const tokenAddress = await rewardToken.getAddress();

    const CampaignManager = await ethers.getContractFactory("CampaignManager");
    campaignManager = await CampaignManager.deploy(tokenAddress);
    await campaignManager.waitForDeployment();

    const campaignManagerAddress = await campaignManager.getAddress();

    const AdInteraction = await ethers.getContractFactory("AdInteraction");
    adInteraction = await AdInteraction.deploy(campaignManagerAddress);
    await adInteraction.waitForDeployment();

    const adInteractionAddress = await adInteraction.getAddress();

    const TokenSale = await ethers.getContractFactory("TokenSale");
    tokenSale = await TokenSale.deploy(tokenAddress, tokensPerEth);
    await tokenSale.waitForDeployment();

    const tokenSaleAddress = await tokenSale.getAddress();

    await campaignManager.setInteractionContract(adInteractionAddress);
    await rewardToken.transfer(tokenSaleAddress, saleSupply);
  });

  it("deploys all contracts correctly", async function () {
    expect(await rewardToken.totalSupply()).to.equal(initialSupply);
    expect(await tokenSale.tokensPerEth()).to.equal(tokensPerEth);
    expect(await tokenSale.getSaleTokenBalance()).to.equal(saleSupply);
  });

  it("allows a user to buy ART from token sale", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("1")
    });

    expect(await rewardToken.balanceOf(advertiser.address)).to.equal(1000);
  });

  it("allows advertiser to approve and create a funded campaign", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("2")
    });

    await rewardToken.connect(advertiser).approve(await campaignManager.getAddress(), budget);

    await campaignManager.connect(advertiser).createCampaign(
      "Nike Ad",
      "https://example.com/ad.mp4",
      rewardPerView,
      budget
    );

    const campaign = await campaignManager.campaigns(1);

    expect(campaign.advertiser).to.equal(advertiser.address);
    expect(campaign.rewardPerView).to.equal(rewardPerView);
    expect(campaign.remainingBudget).to.equal(budget);
    expect(campaign.active).to.equal(true);
  });

  it("allows user to claim reward once", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("2")
    });

    await rewardToken.connect(advertiser).approve(await campaignManager.getAddress(), budget);

    await campaignManager.connect(advertiser).createCampaign(
      "Sample Ad",
      "https://example.com/ad.mp4",
      rewardPerView,
      budget
    );

    await adInteraction.connect(user).claimReward(1);

    expect(await rewardToken.balanceOf(user.address)).to.equal(rewardPerView);

    const claimed = await adInteraction.hasClaimed(user.address, 1);
    expect(claimed).to.equal(true);

    const campaign = await campaignManager.campaigns(1);
    expect(campaign.remainingBudget).to.equal(budget - rewardPerView);
  });

  it("prevents duplicate reward claims", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("2")
    });

    await rewardToken.connect(advertiser).approve(await campaignManager.getAddress(), budget);

    await campaignManager.connect(advertiser).createCampaign(
      "Sample Ad",
      "https://example.com/ad.mp4",
      rewardPerView,
      budget
    );

    await adInteraction.connect(user).claimReward(1);

    await expect(
      adInteraction.connect(user).claimReward(1)
    ).to.be.revertedWith("Already claimed");
  });

  it("prevents advertiser from claiming own campaign", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("2")
    });

    await rewardToken.connect(advertiser).approve(await campaignManager.getAddress(), budget);

    await campaignManager.connect(advertiser).createCampaign(
      "Sample Ad",
      "https://example.com/ad.mp4",
      rewardPerView,
      budget
    );

    await expect(
      adInteraction.connect(advertiser).claimReward(1)
    ).to.be.revertedWith("Advertiser cannot claim");
  });

  it("allows advertiser to deactivate and withdraw remaining budget", async function () {
    await tokenSale.connect(advertiser).buyTokens({
      value: ethers.parseEther("2")
    });

    await rewardToken.connect(advertiser).approve(await campaignManager.getAddress(), budget);

    await campaignManager.connect(advertiser).createCampaign(
      "Sample Ad",
      "https://example.com/ad.mp4",
      rewardPerView,
      budget
    );

    await adInteraction.connect(user).claimReward(1);

    await campaignManager.connect(advertiser).setCampaignActive(1, false);

    const balanceBefore = await rewardToken.balanceOf(advertiser.address);

    await campaignManager.connect(advertiser).withdrawRemainingBudget(1);

    const balanceAfter = await rewardToken.balanceOf(advertiser.address);
    expect(balanceAfter).to.be.gt(balanceBefore);

    const campaign = await campaignManager.campaigns(1);
    expect(campaign.remainingBudget).to.equal(0);
  });
});
