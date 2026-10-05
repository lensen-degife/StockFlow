const db = require('../config/db');

// This function runs automatically on a loop
const startReservationTimer = () => {
  setInterval(async () => {
    try {
      // Find all orders that are RESERVED and past their expiration time
      const expiredOrders = await db.query(`
        SELECT id FROM orders 
        WHERE status = 'RESERVED' AND reservation_expires_at < NOW()
      `);

      for (const row of expiredOrders.rows) {
        const orderId = row.id;
        const client = await db.connect();
        
        try {
          await client.query('BEGIN');
          
          // Double check status with a lock to ensure no race conditions
          const check = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
          if (check.rows[0].status !== 'RESERVED') {
            await client.query('ROLLBACK');
            continue; 
          }

          // Release the inventory
          const items = await client.query('SELECT product_id, warehouse_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
          for (const item of items.rows) {
            await client.query(`
              UPDATE inventory_levels 
              SET quantity_reserved = quantity_reserved - $1 
              WHERE product_id = $2 AND warehouse_id = $3
            `, [item.quantity, item.product_id, item.warehouse_id]);
          }

          // Mark order as expired
          await client.query(`UPDATE orders SET status = 'RESERVATION_EXPIRED' WHERE id = $1`, [orderId]);
          
          await client.query('COMMIT');
          console.log(`✅ Automatically expired reservation for order: ${orderId}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Failed to expire order ${orderId}:`, err.message);
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error("Timer Error:", error.message);
    }
  }, 60 * 1000); // Runs every 60 seconds
};

module.exports = startReservationTimer;