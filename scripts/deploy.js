const { ethers } = require("hardhat");

async function main() {
  const initialSupply = 1_000_000;
  const saleSupply = 500_000;
  const tokensPerEth = 1000;

  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy(initialSupply);
  await rewardToken.waitForDeployment();
  const tokenAddress = await rewardToken.getAddress();

  const CampaignManager = await ethers.getContractFactory("CampaignManager");
  const campaignManager = await CampaignManager.deploy(tokenAddress);
  await campaignManager.waitForDeployment();
  const campaignManagerAddress = await campaignManager.getAddress();

  const AdInteraction = await ethers.getContractFactory("AdInteraction");
  const adInteraction = await AdInteraction.deploy(campaignManagerAddress);
  await adInteraction.waitForDeployment();
  const adInteractionAddress = await adInteraction.getAddress();

  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(tokenAddress, tokensPerEth);
  await tokenSale.waitForDeployment();
  const tokenSaleAddress = await tokenSale.getAddress();

  const setTx = await campaignManager.setInteractionContract(adInteractionAddress);
  await setTx.wait();

  const fundSaleTx = await rewardToken.transfer(tokenSaleAddress, saleSupply);
  await fundSaleTx.wait();

  console.log("RewardToken deployed to:", tokenAddress);
  console.log("CampaignManager deployed to:", campaignManagerAddress);
  console.log("AdInteraction deployed to:", adInteractionAddress);
  console.log("TokenSale deployed to:", tokenSaleAddress);

  console.log("\nFrontend config");
  console.log("tokenAddress =", tokenAddress);
  console.log("campaignManagerAddress =", campaignManagerAddress);
  console.log("adInteractionAddress =", adInteractionAddress);
  console.log("tokenSaleAddress =", tokenSaleAddress);
  console.log("tokensPerEth =", tokensPerEth);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
