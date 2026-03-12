const { ethers } = require("hardhat");

async function main() {

    const adManagerAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    const AdManager = await ethers.getContractAt("AdManager", adManagerAddress);

    const filter = AdManager.filters.AdWatched();

    const events = await AdManager.queryFilter(filter);

    console.log("Total Ad Views:", events.length);

    let totalRewards = 0;

    for (let event of events) {

        totalRewards += Number(event.args.reward);

    }

    console.log("Total Rewards Distributed:", totalRewards);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});