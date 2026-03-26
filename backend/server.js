const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "adreward",
  password: "postgres123",
  port: 5432,
});

// Test route
app.get("/", (req, res) => {
  res.send("Backend working");
});

// Save transaction (✅ duplicate-safe)
app.post("/transaction", async (req, res) => {
  const { user, campaignId, reward } = req.body;

  await pool.query(
    "INSERT INTO transactions(user_address, campaign_id, reward) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [user, campaignId, reward]
  );

  res.send("Saved");
});

// Get history
app.get("/history/:address", async (req, res) => {
  const data = await pool.query(
    "SELECT * FROM transactions WHERE user_address=$1 ORDER BY timestamp DESC",
    [req.params.address]
  );

  res.json(data.rows);
});

app.listen(3001, () => console.log("Backend running on 3001"));