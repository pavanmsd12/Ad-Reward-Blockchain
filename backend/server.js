const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { ethers } = require("ethers");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const VERIFIER_PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY || process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const verifierWallet = new ethers.Wallet(VERIFIER_PRIVATE_KEY);
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

async function initializeDatabase() {  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_sessions (
      id SERIAL PRIMARY KEY,
      user_address TEXT NOT NULL,
      campaign_id INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed BOOLEAN DEFAULT FALSE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      phone_number TEXT PRIMARY KEY,
      user_address TEXT UNIQUE NOT NULL,
      verified BOOLEAN DEFAULT FALSE,
      otp TEXT,
      otp_expiry TIMESTAMP
    )
  `);

  

  // Modifying user constraints so phone can be stored BEFORE wallet is connected
  await pool.query("ALTER TABLE users ALTER COLUMN user_address DROP NOT NULL");
}

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

app.get("/", (req, res) => { res.json({ status: "ok", service: "adreward-backend" }); });

// ==========================================
// KYC / PHONE OTP VERIFICATION (WEB2-FIRST)
// ==========================================

app.post("/auth/send-otp-signup", async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) return res.status(400).json({ error: "Invalid phone number." });

  try {
    const exist = await pool.query("SELECT * FROM users WHERE phone_number = $1", [phone]);
    if (exist.rows.length > 0 && exist.rows[0].verified) {
      return res.status(400).json({ error: "Phone already registered. Please Sign In instead." });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = new Date(Date.now() + 5 * 60000); 
    
    await pool.query(
      `INSERT INTO users (phone_number, otp, otp_expiry, verified) 
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (phone_number) DO UPDATE 
       SET otp = EXCLUDED.otp, otp_expiry = EXCLUDED.otp_expiry`,
      [phone, otp, expiry]
    );

    console.log(`\n📨 SIGN-UP OTP | Phone: ${phone} | OTP: ${otp} \n`);
    return res.json({ success: true, message: "Signup OTP sent to terminal!" });
  } catch(e) {
    return res.status(500).json({ error: "Failed to generate OTP" });
  }
});

app.post("/auth/verify-signup", async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const result = await pool.query("SELECT otp, otp_expiry, verified FROM users WHERE phone_number = $1", [phone]);
    if (result.rows.length === 0 || result.rows[0].verified) return res.status(400).json({ error: "Invalid signup request." });

    if (new Date() > new Date(result.rows[0].otp_expiry)) return res.status(400).json({ error: "OTP has expired." });
    if (result.rows[0].otp !== otp) return res.status(400).json({ error: "Invalid OTP code." });

    await pool.query("UPDATE users SET verified = TRUE, otp = NULL WHERE phone_number = $1", [phone]);
    return res.json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: "Signup verification failed." });
  }
});

app.post("/auth/link-wallet", async (req, res) => {
  const { phone, user } = req.body;
  if (!isValidAddress(user) || !phone) return res.status(400).json({ error: "Invalid parameters." });
  
  try {
    const walletExist = await pool.query("SELECT * FROM users WHERE user_address = $1", [user.toLowerCase()]);
    if (walletExist.rows.length > 0 && walletExist.rows[0].phone_number !== phone) {
      return res.status(400).json({ error: "This Wallet is already linked to another account." });
    }

    const result = await pool.query("UPDATE users SET user_address = $1 WHERE phone_number = $2 AND verified = TRUE RETURNING phone_number", [user.toLowerCase(), phone]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Account not verified or does not exist." });
    
    return res.json({ success: true, message: "Wallet successfully mapped." });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ error: "Wallet already in use." });
    return res.status(500).json({ error: "Failed to link wallet." });
  }
});

app.post("/auth/send-otp-signin", async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) return res.status(400).json({ error: "Invalid phone number." });

  try {
    const exist = await pool.query("SELECT * FROM users WHERE phone_number = $1 AND verified = TRUE", [phone]);
    if (exist.rows.length === 0) return res.status(400).json({ error: "Phone not registered. Please Sign Up." });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = new Date(Date.now() + 5 * 60000); 

    await pool.query("UPDATE users SET otp = $1, otp_expiry = $2 WHERE phone_number = $3", [otp, expiry, phone]);
    
    console.log(`\n📨 SIGN-IN OTP | Phone: ${phone} | OTP: ${otp} \n`);
    return res.json({ success: true, message: "Signin OTP sent!" });
  } catch(e) {
    return res.status(500).json({ error: "Signin OTP failed." });
  }
});

app.post("/auth/verify-signin", async (req, res) => {
  const { phone, otp } = req.body;
  try {
    const result = await pool.query("SELECT otp, otp_expiry, user_address FROM users WHERE phone_number = $1 AND verified = TRUE", [phone]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Phone not registered." });

    if (new Date() > new Date(result.rows[0].otp_expiry)) return res.status(400).json({ error: "OTP has expired." });
    if (result.rows[0].otp !== otp) return res.status(400).json({ error: "Invalid OTP code." });

    await pool.query("UPDATE users SET otp = NULL WHERE phone_number = $1", [phone]);
    return res.json({ success: true, linkedWallet: result.rows[0].user_address });
  } catch(e) {
    return res.status(500).json({ error: "Signin verification failed." });
  }
});

// ==========================================
// WATCH SESSIONS & REWARD LOGIC
// ==========================================

app.post("/watch/start", async (req, res) => {
  const { user, campaignId } = req.body;
  if (!isValidAddress(user)) return res.status(400).json({ error: "Invalid wallet address." });
  if (!Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0) return res.status(400).json({ error: "Invalid campaign id." });

  try {
    const result = await pool.query("SELECT verified FROM users WHERE user_address = $1 AND verified = TRUE", [user.toLowerCase()]);
    if (result.rows.length === 0) return res.status(403).json({ error: "Wallet not registered/verified via Phone KYC." });
  } catch(e) { return res.status(500).json({ error: "Auth verification error." }); }

  try {
    await pool.query(`INSERT INTO watch_sessions (user_address, campaign_id, completed) VALUES ($1, $2, FALSE)`, [user.toLowerCase(), Number(campaignId)]);
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Failed to start watch session." }); }
});

app.post("/watch/complete", async (req, res) => {
  const { user, campaignId } = req.body;
  if (!isValidAddress(user) || !Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0) return res.status(400).json({ error: "Invalid parameters." });

  try {
    const result = await pool.query(
      `UPDATE watch_sessions SET completed = TRUE
       WHERE id = (SELECT id FROM watch_sessions WHERE user_address = $1 AND campaign_id = $2 AND completed = FALSE ORDER BY started_at DESC LIMIT 1) RETURNING id`,
      [user.toLowerCase(), Number(campaignId)]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: "No active watch session found." });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Failed to complete watch session." }); }
});

app.post("/watch/sign", async (req, res) => {
  const { user, campaignId } = req.body;
  if (!isValidAddress(user) || !Number.isInteger(Number(campaignId)) || Number(campaignId) <= 0) return res.status(400).json({ error: "Invalid parameters." });

  try {
    const result = await pool.query(
      `SELECT id FROM watch_sessions WHERE user_address = $1 AND campaign_id = $2 AND completed = TRUE ORDER BY started_at DESC LIMIT 1`,
      [user.toLowerCase(), Number(campaignId)]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: "No valid completed watch session found." });

    const messageHash = ethers.solidityPackedKeccak256(["address", "uint256"], [user, campaignId]);
    const messageHashBytes = ethers.getBytes(messageHash);
    const signature = await verifierWallet.signMessage(messageHashBytes);
    return res.json({ signature });
  } catch (error) { return res.status(500).json({ error: "Failed to validate watch session signature." }); }
});


initializeDatabase().then(() => {
  app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
}).catch(console.error);
