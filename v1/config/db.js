import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

console.log(`host: ${process.env.DB_HOST},
  port: ${process.env.DB_PORT},
  database: ${process.env.DB_NAME},
  user: ${process.env.DB_USER},
  password: ${process.env.DB_PASSWORD} `);
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test connection
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle client", err);
  process.exit(-1);
});

// Wrapper for queries
export const query = (text, params) => pool.query(text, params);

export { pool };
