require('dotenv').config(); 
const db = require('./config/db'); 

async function createInventoryTable() {
  try {
    console.log("Creating inventory_levels table...");
    
    // We create the table and add a UNIQUE constraint so our UPSERT rule works!
    await db.query(`drop table if exists inventory_levels;`); // Drop the table if it exists for a clean slate
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_levels (
        id SERIAL PRIMARY KEY,
        organization_id UUID NOT NULL,
        product_id UUID NOT NULL,
        warehouse_id UUID NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, warehouse_id)
      );
    `);
    
    console.log("✅ Success! The inventory_levels table has been created.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}

createInventoryTable();