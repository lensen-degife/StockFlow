require('dotenv').config(); 
const db = require('./config/db'); 

async function createOrderTables() {
  try {
    console.log("Creating orders and order_items tables...");
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        customer_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'DRAFT',
        total DECIMAL(10,2) NOT NULL,
        reservation_expires_at TIMESTAMP,
        idempotency_key VARCHAR(255),
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        product_id UUID NOT NULL,
        warehouse_id UUID NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL
      );
    `);
    
    console.log("✅ Success! The Orders tables have been created.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}

createOrderTables();