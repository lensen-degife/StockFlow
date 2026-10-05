require('dotenv').config(); 
const db = require('./config/db'); 

async function getValidIds() {
  try {
    const customers = await db.query('SELECT id, name FROM customers');
    console.log("\n✅ VALID CUSTOMER IDs:");
    console.table(customers.rows);

    const products = await db.query('SELECT id, name FROM products');
    console.log("\n✅ VALID PRODUCT IDs:");
    console.table(products.rows);
    
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(); 
  }
}

getValidIds();