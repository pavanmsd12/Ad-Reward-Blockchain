const { ethers } = require("hardhat");

async function main() {

  // Deploy RewardToken
  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy(10000);

  await rewardToken.waitForDeployment();

  const tokenAddress = await rewardToken.getAddress();
  console.log("RewardToken deployed to:", tokenAddress);


  // Deploy AdManager
  const AdManager = await ethers.getContractFactory("AdManager");
  const adManager = await AdManager.deploy(tokenAddress);

  await adManager.waitForDeployment();

  const adManagerAddress = await adManager.getAddress();
  console.log("AdManager deployed to:", adManagerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});