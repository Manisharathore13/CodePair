
require("dotenv").config();

const pool = require("./db");

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS code TEXT NOT NULL
      DEFAULT '// Start coding here...'
    `);

    await pool.query(`
      ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL
      DEFAULT 'cpp'
    `);

    console.log("Success: code and language columns are ready.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
