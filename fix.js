require('dotenv').config(); 
const db = require('./config/db'); 

async function createAuditTable() {
  try {
    console.log("Creating audit_logs table...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        actor_id UUID NOT NULL,
        action VARCHAR(255) NOT NULL,
        resource_type VARCHAR(255) NOT NULL,
        resource_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("✅ Success! The audit_logs table has been created.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}

createAuditTable();