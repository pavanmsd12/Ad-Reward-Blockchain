const { ethers } = require("ethers");
const axios = require("axios");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const AD_INTERACTION_ADDRESS =
  process.env.AD_INTERACTION_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const provider = new ethers.JsonRpcProvider(RPC_URL);

const contract = new ethers.Contract(
  AD_INTERACTION_ADDRESS,
  ["event AdClaimed(address indexed user, uint256 indexed campaignId, uint256 reward)"],
  provider
);

async function syncEvent(event) {
  const { user, campaignId, reward } = event.args;

  const payload = {
    user,
    campaignId: Number(campaignId),
    reward: Number(reward),
    eventKey: `${event.transactionHash}-${event.index}`,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  };

  await axios.post(`${BACKEND_URL}/transaction`, payload);
}

async function backfillEvents() {
  try {
    const events = await contract.queryFilter(contract.filters.AdClaimed(), 0, "latest");

    for (const event of events) {
      await syncEvent(event);
      console.log(`Backfilled campaign ${event.args.campaignId.toString()} from tx ${event.transactionHash}`);
    }
  } catch (error) {
    console.error("Backfill failed:", error.message);
  }
}

function listenForNewEvents() {
  contract.on("AdClaimed", async (user, campaignId, reward, event) => {
    try {
      await syncEvent(event);
      console.log(`Synced live claim for campaign ${campaignId.toString()} and user ${user}`);
    } catch (error) {
      console.error("Live event sync failed:", error.message);
    }
  });
}

async function startListener() {
  console.log(`Listening for AdClaimed events on ${AD_INTERACTION_ADDRESS}`);
  await backfillEvents();
  listenForNewEvents();
}

startListener().catch((error) => {
  console.error("Listener startup failed:", error);
  process.exit(1);
});
