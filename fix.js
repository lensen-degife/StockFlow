require('dotenv').config(); 
const db = require('./config/db'); 

async function addReservedColumn() {
  try {
    console.log("Adding quantity_reserved to inventory...");
    await db.query(`
      ALTER TABLE inventory_levels 
      ADD COLUMN IF NOT EXISTS quantity_reserved INTEGER NOT NULL DEFAULT 0;
    `);
    console.log("✅ Success! Column added.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}
addReservedColumn();