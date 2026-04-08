require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { ethers } = require("ethers");
const axios = require("axios");

const RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  process.env.RPC_URL ||
  "http://127.0.0.1:8545";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

const AD_INTERACTION_ADDRESS =
  process.env.AD_INTERACTION_ADDRESS ||
  "0xc5b6d2dbbb399271d19230ca50fa3df49a60154f";

const CHUNK_SIZE = 50000;
const POLL_INTERVAL_MS = 15000;

const provider = new ethers.JsonRpcProvider(RPC_URL);

const contract = new ethers.Contract(
  AD_INTERACTION_ADDRESS,
  ["event AdClaimed(address indexed user, uint256 indexed campaignId, uint256 reward)"],
  provider
);

let lastProcessedBlock = null;

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

async function processRange(fromBlock, toBlock) {
  if (fromBlock > toBlock) return;

  const events = await contract.queryFilter(
    contract.filters.AdClaimed(),
    fromBlock,
    toBlock
  );

  for (const event of events) {
    await syncEvent(event);
    console.log(
      `Synced campaign ${event.args.campaignId.toString()} from tx ${event.transactionHash}`
    );
  }
}

async function backfillInChunks(fromBlock, toBlock) {
  let start = fromBlock;

  while (start <= toBlock) {
    const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
    await processRange(start, end);
    start = end + 1;
  }
}

async function startListener() {
  console.log(`Listening for AdClaimed events on ${AD_INTERACTION_ADDRESS}`);

  const latestBlock = await provider.getBlockNumber();

  // For a fresh Sepolia deployment, only look back a little unless you want more history.
  const initialFromBlock = Math.max(latestBlock - 10000, 0);

  await backfillInChunks(initialFromBlock, latestBlock);
  lastProcessedBlock = latestBlock;

  console.log(`Initial sync complete up to block ${lastProcessedBlock}`);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock > lastProcessedBlock) {
        await backfillInChunks(lastProcessedBlock + 1, currentBlock);
        lastProcessedBlock = currentBlock;
      }
    } catch (error) {
      console.error("Polling error:", error.message);
    }
  }, POLL_INTERVAL_MS);
}

startListener().catch((error) => {
  console.error("Listener startup failed:", error);
  process.exit(1);
});
