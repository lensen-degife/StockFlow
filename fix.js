require('dotenv').config(); 
const db = require('./config/db'); 

async function checkAuditLogs() {
  try {
    const logs = await db.query('SELECT * FROM audit_logs');
    console.log(`\n✅ FOUND ${logs.rows.length} AUDIT LOGS:`);
    console.table(logs.rows);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}

checkAuditLogs();