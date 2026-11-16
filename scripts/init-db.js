require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
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
