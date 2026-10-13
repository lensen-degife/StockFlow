const db = require('../../config/db');

// POST /orders
const createOrder = async (req, res) => {
  const { customer_id, items } = req.body;
  const organizationId = req.user.organizationId;
  const createdBy = req.user.userId;
  const idempotencyKey = req.headers['idempotency-key']; // Read from headers

  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key header is required' }
    });
  }

  if (!customer_id || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Customer ID and at least one item are required' }
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Calculate the total server-side to prevent tampering
    let total = 0;
    for (const item of items) {
      total += (item.quantity * item.unit_price);
    }

    // 2. Insert the main DRAFT order
    const orderResult = await client.query(`
      INSERT INTO orders (organization_id, customer_id, total, idempotency_key, created_by, status)
      VALUES ($1, $2, $3, $4, $5, 'DRAFT')
      RETURNING id, status, total, created_at
    `, [organizationId, customer_id, total, idempotencyKey, createdBy]);

    const newOrderId = orderResult.rows[0].id;

    // 3. Insert all the individual order items
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, warehouse_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [newOrderId, item.product_id, item.warehouse_id, item.quantity, item.unit_price]);
    }

    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [organizationId, createdBy, 'CREATED_ORDER', 'order', newOrderId]);

    await client.query('COMMIT'); // Save everything!

    res.status(201).json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: items
      }
    });

  } catch (error) {
    await client.query('ROLLBACK'); // Undo if anything fails
    console.error("CREATE ORDER ERROR:", error);

    // Catch the specific unique constraint violation for the Idempotency Key
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'An order with this Idempotency-Key was already created.' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  } finally {
    client.release();
  }
};

// POST /orders/:orderId/reserve
const reserveOrder = async (req, res) => {
  const { orderId } = req.params;
  const organizationId = req.user.organizationId;
  const actorId = req.user.userId;
  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Check if order exists and is in DRAFT state
    const orderCheck = await client.query(
      'SELECT status FROM orders WHERE id = $1 AND organization_id = $2',
      [orderId, organizationId]
    );

    if (orderCheck.rows.length === 0) {
      throw new Error('Order not found');
    }
    if (orderCheck.rows[0].status !== 'DRAFT') {
      throw new Error('Order is not in DRAFT status');
    }

    // 2. Fetch the items for this order
    const items = await client.query(
      'SELECT product_id, warehouse_id, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );

    // 3. Loop through items and securely lock the inventory rows
    for (const item of items.rows) {
      // THE MAGIC LOCK: "FOR UPDATE"
      const inventoryResult = await client.query(`
        SELECT quantity, quantity_reserved 
        FROM inventory_levels 
        WHERE product_id = $1 AND warehouse_id = $2 AND organization_id = $3
        FOR UPDATE
      `, [item.product_id, item.warehouse_id, organizationId]);

      if (inventoryResult.rows.length === 0) {
        throw new Error(`Inventory record not found for product ${item.product_id}`);
      }

      const inv = inventoryResult.rows[0];
      const available = inv.quantity - inv.quantity_reserved; // Calculate real available stock

      if (available < item.quantity) {
        throw new Error(`Insufficient inventory for product ${item.product_id}. Only ${available} available.`);
      }

      // 4. Reserve the stock
      await client.query(`
        UPDATE inventory_levels 
        SET quantity_reserved = quantity_reserved + $1 
        WHERE product_id = $2 AND warehouse_id = $3
      `, [item.quantity, item.product_id, item.warehouse_id]);
    }

    // 5. Update the order status and set expiration (e.g., 15 minutes from now)
    const updatedOrder = await client.query(`
      UPDATE orders 
      SET status = 'RESERVED', reservation_expires_at = NOW() + INTERVAL '15 minutes'
      WHERE id = $1
      RETURNING id, status, reservation_expires_at
    `, [orderId]);

    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [organizationId, actorId, 'RESERVED_ORDER', 'order', orderId]);

    await client.query('COMMIT'); // Release the locks and save!

    res.status(200).json({ success: true, data: updatedOrder.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); // Undo everything and release locks if anything fails
    console.error("RESERVE ERROR:", error.message);

    if (error.message.includes('not found') || error.message.includes('status') || error.message.includes('Insufficient')) {
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
    client.release();
  }
};

// POST /orders/:orderId/confirm
const confirmOrder = async (req, res) => {
  const { orderId } = req.params;
  const organizationId = req.user.organizationId;
  const actorId = req.user.userId;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const orderCheck = await client.query(
      'SELECT status FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [orderId, organizationId]
    );

    if (orderCheck.rows.length === 0) throw new Error('Order not found');
    if (orderCheck.rows[0].status !== 'RESERVED') throw new Error('Order must be RESERVED before confirming');

    const updatedOrder = await client.query(`
      UPDATE orders SET status = 'CONFIRMED' WHERE id = $1 RETURNING id, status
    `, [orderId]);

    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [organizationId, actorId, 'CONFIRMED_ORDER', 'order', orderId]);

    await client.query('COMMIT');
    res.status(200).json({ success: true, data: updatedOrder.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("CONFIRM ERROR:", error.message);
    if (error.message.includes('not found') || error.message.includes('must be')) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error.' } });
  } finally {
    client.release();
  }
};

// POST /orders/:orderId/cancel
const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const organizationId = req.user.organizationId;
  const actorId = req.user.userId;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const orderCheck = await client.query(
      'SELECT status FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [orderId, organizationId]
    );

    if (orderCheck.rows.length === 0) throw new Error('Order not found');
    const currentStatus = orderCheck.rows[0].status;

    if (currentStatus === 'FULFILLED' || currentStatus === 'CANCELLED') {
      throw new Error(`Cannot cancel an order that is already ${currentStatus}`);
    }

    // If the order was holding stock, we must release it back to the warehouse
    if (currentStatus === 'RESERVED' || currentStatus === 'CONFIRMED') {
      const items = await client.query('SELECT product_id, warehouse_id, quantity FROM order_items WHERE order_id = $1', [orderId]);

      for (const item of items.rows) {
        await client.query(`
          UPDATE inventory_levels 
          SET quantity_reserved = quantity_reserved - $1 
          WHERE product_id = $2 AND warehouse_id = $3
        `, [item.quantity, item.product_id, item.warehouse_id]);
      }
    }

    const updatedOrder = await client.query(`
      UPDATE orders SET status = 'CANCELLED' WHERE id = $1 RETURNING id, status
    `, [orderId]);

    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [organizationId, actorId, 'CANCELLED_ORDER', 'order', orderId]);

    await client.query('COMMIT');
    res.status(200).json({ success: true, data: updatedOrder.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("CANCEL ERROR:", error.message);
    if (error.message.includes('not found') || error.message.includes('Cannot cancel')) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error.' } });
  } finally {
    client.release();
  }
};

// POST /orders/:orderId/fulfill
const fulfillOrder = async (req, res) => {
  const { orderId } = req.params;
  const organizationId = req.user.organizationId;
  const actorId = req.user.userId;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the order and verify it is CONFIRMED
    const orderCheck = await client.query(
      'SELECT status FROM orders WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [orderId, organizationId]
    );

    if (orderCheck.rows.length === 0) throw new Error('Order not found');
    if (orderCheck.rows[0].status !== 'CONFIRMED') {
      throw new Error('Order must be CONFIRMED before it can be fulfilled');
    }

    // 2. Fetch the items
    const items = await client.query(
      'SELECT product_id, warehouse_id, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );

    // 3. Permanently remove the inventory (subtract from BOTH total and reserved)
    for (const item of items.rows) {
      await client.query(`
        UPDATE inventory_levels 
        SET quantity = quantity - $1, 
            quantity_reserved = quantity_reserved - $1 
        WHERE product_id = $2 AND warehouse_id = $3
      `, [item.quantity, item.product_id, item.warehouse_id]);
    }

    // 4. Mark the order as FULFILLED
    const updatedOrder = await client.query(`
      UPDATE orders SET status = 'FULFILLED' WHERE id = $1 RETURNING id, status
    `, [orderId]);

    await client.query(`
      INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [organizationId, actorId, 'FULFILLED_ORDER', 'order', orderId]);

    await client.query('COMMIT');
    res.status(200).json({ success: true, data: updatedOrder.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("FULFILL ERROR:", error.message);
    if (error.message.includes('not found') || error.message.includes('must be')) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error.' } });
  } finally {
    client.release();
  }
};

// GET /orders
const getOrders = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const query = `
      SELECT 
        o.id, 
        o.organization_id, 
        o.customer_id, 
        c.name AS customer_name, 
        o.status, 
        o.total, 
        o.created_at,
        COALESCE(COUNT(oi.id), 0)::int AS items_count
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.organization_id = $1
      GROUP BY o.id, c.name
      ORDER BY o.created_at DESC
    `;

    const result = await db.query(query, [organizationId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /orders/:orderId
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const organizationId = req.user.organizationId;

    const orderResult = await db.query(
      `SELECT o.*, c.name as customer_name, c.email as customer_email 
       FROM orders o 
       LEFT JOIN customers c ON c.id = o.customer_id 
       WHERE o.id = $1 AND o.organization_id = $2`,
      [orderId, organizationId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' }
      });
    }

    const itemsResult = await db.query(
      `SELECT oi.*, p.name as product_name, p.sku as product_sku, w.name as warehouse_name 
       FROM order_items oi 
       LEFT JOIN products p ON p.id = oi.product_id 
       LEFT JOIN warehouses w ON w.id = oi.warehouse_id 
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.status(200).json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error("GET ORDER BY ID ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createOrder, reserveOrder, confirmOrder, cancelOrder, fulfillOrder, getOrders, getOrderById };