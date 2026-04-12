const { Pool } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "adreward",
  password: process.env.DB_PASSWORD || "postgres123",
  port: Number(process.env.DB_PORT || 5432),
});

async function wipeDatabase() {
  try {
    console.log("Wiping database tables...");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query("DROP TABLE IF EXISTS watch_sessions CASCADE");
    await pool.query("DROP TABLE IF EXISTS transactions CASCADE");
    console.log("✅ Database wiped successfully!");
  } catch (error) {
    console.error("❌ Error wiping database:", error);
  } finally {
    pool.end();
  }
}

wipeDatabase();
