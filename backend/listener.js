const { ethers } = require("ethers");
const axios = require("axios");

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const abi = [
  "event AdWatched(address user, uint campaignId, uint reward)"
];

const contract = new ethers.Contract(contractAddress, abi, provider);

// 🔥 Fetch past events
async function fetchPastEvents() {
  const events = await contract.queryFilter("AdWatched", 0, "latest");

  for (const e of events) {
    const { user, campaignId, reward } = e.args;

    await axios.post("http://localhost:3001/transaction", {
      user,
      campaignId: Number(campaignId),
      reward: Number(reward)
    });

    console.log("Backfilled:", campaignId.toString());
  }
}

// 🔥 Listen new events
contract.on("AdWatched", async (user, campaignId, reward) => {
  console.log("New Event:", campaignId.toString());

  await axios.post("http://localhost:3001/transaction", {
    user,
    campaignId: Number(campaignId),
    reward: Number(reward)
  });
});

fetchPastEvents();