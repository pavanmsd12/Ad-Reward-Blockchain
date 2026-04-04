const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3001);

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "adreward",
  password: process.env.DB_PASSWORD || "postgres123",
  port: Number(process.env.DB_PORT || 5432),
});

app.use(cors());
app.use(express.json());

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_address TEXT NOT NULL,
      campaign_id INTEGER NOT NULL,
      reward NUMERIC NOT NULL,
      event_key TEXT,
      tx_hash TEXT,
      block_number INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS event_key TEXT");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS block_number INTEGER");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS transactions_event_key_idx ON transactions(event_key) WHERE event_key IS NOT NULL");
}

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "adreward-backend",
  });
});

app.post("/transaction", async (req, res) => {
  const { user, campaignId, reward, eventKey, txHash, blockNumber } = req.body;

  if (!isValidAddress(user)) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  if (!Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0) {
    return res.status(400).json({ error: "Invalid campaign id." });
  }

  if (Number(reward) <= 0) {
    return res.status(400).json({ error: "Invalid reward amount." });
  }

  try {
    await pool.query(
      `
        INSERT INTO transactions (user_address, campaign_id, reward, event_key, tx_hash, block_number)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_key) DO NOTHING
      `,
      [user.toLowerCase(), Number(campaignId), Number(reward), eventKey || null, txHash || null, blockNumber ?? null]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to save transaction:", error);
    return res.status(500).json({ error: "Failed to save transaction." });
  }
});

app.get("/history/:address", async (req, res) => {
  const { address } = req.params;

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  try {
    const result = await pool.query(
      `
        SELECT user_address, campaign_id, reward, tx_hash, block_number, timestamp
        FROM transactions
        WHERE user_address = $1
        ORDER BY timestamp DESC, id DESC
      `,
      [address.toLowerCase()]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return res.status(500).json({ error: "Failed to fetch reward history." });
  }
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
