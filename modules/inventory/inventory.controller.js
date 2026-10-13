const db = require('../../config/db');

// POST /inventory/adjust
const adjustStock = async (req, res) => {
  const { product_id, warehouse_id, quantity_change } = req.body;
  const organizationId = req.user.organizationId;

  if (!product_id || !warehouse_id || quantity_change === undefined) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Product ID, Warehouse ID, and quantity_change are required' }
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Start the safety transaction

    // 1. Verify the product belongs to this organization
    const productCheck = await client.query(
      'SELECT id FROM products WHERE id = $1 AND organization_id = $2',
      [product_id, organizationId]
    );
    if (productCheck.rows.length === 0) {
      throw new Error('Product not found in your organization');
    }

    // 2. Verify the warehouse belongs to this organization
    const warehouseCheck = await client.query(
      'SELECT id FROM warehouses WHERE id = $1 AND organization_id = $2',
      [warehouse_id, organizationId]
    );
    if (warehouseCheck.rows.length === 0) {
      throw new Error('Warehouse not found in your organization');
    }

    // 3. UPSERT the inventory level
    // This tells Postgres: Try to insert a new row. If a row with this product and warehouse already exists, 
    // just ADD the quantity_change to the existing quantity!
    const inventoryResult = await client.query(`
      INSERT INTO inventory_levels (organization_id, product_id, warehouse_id, quantity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, warehouse_id) 
      DO UPDATE SET quantity = inventory_levels.quantity + EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
      RETURNING id, product_id, warehouse_id, quantity
    `, [organizationId, product_id, warehouse_id, quantity_change]);

    // Prevent negative inventory
    if (inventoryResult.rows[0].quantity < 0) {
      throw new Error('Insufficient stock for this transaction');
    }

    // (Optional but recommended) 4. Log this movement in a stock_movements ledger table here

    await client.query('COMMIT'); // Everything worked, save it!
    
    res.status(200).json({ success: true, data: inventoryResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); // Undo if anything failed!
    console.error("ADJUST STOCK ERROR:", error.message);
    
    // Return friendly errors for our custom throws
    if (error.message.includes('not found') || error.message.includes('Insufficient')) {
       return res.status(400).json({
         success: false,
         error: { code: 'BAD_REQUEST', message: error.message }
       });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  } finally {
    client.release(); // Give the connection back to the pool
  }
};

// GET /inventory
// See all stock levels for the organization
const getInventory = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    const result = await db.query(`
      SELECT i.product_id, i.warehouse_id, i.quantity, p.name AS product_name, p.sku, w.name AS warehouse_name
      FROM inventory_levels i
      JOIN products p ON i.product_id = p.id
      JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.organization_id = $1
      ORDER BY p.name ASC, w.name ASC
    `, [organizationId]);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET INVENTORY ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// POST /inventory/transfer
// POST /inventory/transfer
const transferStock = async (req, res) => {
  const { product_id, from_warehouse_id, to_warehouse_id, quantity } = req.body;
  const organizationId = req.user.organizationId;
  const userId = req.user.userId;

  if (from_warehouse_id === to_warehouse_id) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot transfer to the same warehouse' } });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Deduct from Source Warehouse (Removed updated_at)
    const deductResult = await client.query(
      `UPDATE inventory 
       SET quantity_on_hand = quantity_on_hand - $1
       WHERE product_id = $2 AND warehouse_id = $3 AND organization_id = $4
       RETURNING quantity_on_hand`,
      [quantity, product_id, from_warehouse_id, organizationId]
    );

    if (deductResult.rows.length === 0) {
      throw new Error('Source inventory not found or insufficient stock');
    }

    // 2. Add to Destination Warehouse (Removed updated_at)
    await client.query(
      `INSERT INTO inventory (organization_id, warehouse_id, product_id, quantity_on_hand)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (warehouse_id, product_id) 
       DO UPDATE SET quantity_on_hand = inventory.quantity_on_hand + EXCLUDED.quantity_on_hand`,
      [organizationId, to_warehouse_id, product_id, quantity]
    );

    // 3. Write OUT movement
    await client.query(
      `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity)
       VALUES ($1, $2, $3, 'TRANSFER_OUT', $4)`,
      [organizationId, from_warehouse_id, product_id, -quantity]
    );

    // 4. Write IN movement
    await client.query(
      `INSERT INTO inventory_movements (organization_id, warehouse_id, product_id, type, quantity)
       VALUES ($1, $2, $3, 'TRANSFER_IN', $4)`,
      [organizationId, to_warehouse_id, product_id, quantity]
    );

    // 5. Audit Log
    await client.query(
      `INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'TRANSFERRED_STOCK', 'product', $3)`,
      [organizationId, userId, product_id]
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, data: { message: 'Transfer successful' } });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("TRANSFER ERROR:", error);
    
    // Catch our database CHECK constraint violation for negative stock
    if (error.code === '23514' || error.message.includes('insufficient stock')) {
        return res.status(400).json({ success: false, error: { code: 'INSUFFICIENT_INVENTORY', message: 'Not enough stock to transfer' } });
    }

    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to transfer inventory' } });
  } finally {
    client.release();
  }
};


module.exports = { adjustStock, getInventory, transferStock};