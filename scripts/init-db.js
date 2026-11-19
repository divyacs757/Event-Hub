
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from the environment");
  }

  console.log("Database host:", new URL(databaseUrl).hostname);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(sql);
    console.log("Database schema created successfully.");
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();