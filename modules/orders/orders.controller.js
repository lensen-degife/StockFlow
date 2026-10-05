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

module.exports = { createOrder };