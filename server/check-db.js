
require("dotenv").config();

const pool = require("./db");

async function checkDatabase() {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'rooms'
       ORDER BY ordinal_position`
    );

    console.table(result.rows);
  } catch (error) {
    console.error("Database error:", error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
