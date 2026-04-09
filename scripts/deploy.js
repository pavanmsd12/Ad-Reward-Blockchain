const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Using 18 decimals, parseEther handles the 10^18 multiplier automatically
  // 100% of supply goes to TokenSale to decentralize control
  const tokenSupply = ethers.parseEther("2000000"); // 2 Million ART total supply
  const saleSupply = tokenSupply; // Send 100% of tokens to the TokenSale contract
  const tokensPerEth = 10000; // 1 ETH = 10000 ART

  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy(tokenSupply);
  await rewardToken.waitForDeployment();
  const tokenAddress = await rewardToken.getAddress();

  const CampaignManager = await ethers.getContractFactory("CampaignManager");
  const campaignManager = await CampaignManager.deploy(tokenAddress);
  await campaignManager.waitForDeployment();
  const campaignManagerAddress = await campaignManager.getAddress();

  const AdInteraction = await ethers.getContractFactory("AdInteraction");
  // Set the deployer address as the initial verifier
  const adInteraction = await AdInteraction.deploy(campaignManagerAddress, deployer.address);
  await adInteraction.waitForDeployment();
  const adInteractionAddress = await adInteraction.getAddress();

  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(tokenAddress, tokensPerEth);
  await tokenSale.waitForDeployment();
  const tokenSaleAddress = await tokenSale.getAddress();

  const setTx = await campaignManager.setInteractionContract(adInteractionAddress);
  await setTx.wait();

  // Fund TokenSale contract
  const fundSaleTx = await rewardToken.transfer(tokenSaleAddress, saleSupply);
  await fundSaleTx.wait();

  console.log("RewardToken deployed to:", tokenAddress);
  console.log("CampaignManager deployed to:", campaignManagerAddress);
  console.log("AdInteraction deployed to:", adInteractionAddress);
  console.log("TokenSale deployed to:", tokenSaleAddress);

  console.log("\nUpdate config in app.js:");
  console.log("tokenAddress: '" + tokenAddress + "',");
  console.log("campaignManagerAddress: '" + campaignManagerAddress + "',");
  console.log("adInteractionAddress: '" + adInteractionAddress + "',");
  console.log("tokenSaleAddress: '" + tokenSaleAddress + "',");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
