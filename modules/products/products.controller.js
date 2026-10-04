const db = require('../../config/db');

// POST /products
const createProduct = async (req, res) => {
  try {
    const { sku, name, price } = req.body;
    const organizationId = req.user.organizationId; // Supplied by requireRole middleware

    if (!sku || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'SKU, name, and price are required' }
      });
    }

    const result = await db.query(
      'INSERT INTO products (organization_id, sku, name, price) VALUES ($1, $2, $3, $4) RETURNING id, sku, name, price, status',
      [organizationId, sku, name, price]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (SKU already exists for this org)
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A product with this SKU already exists in your organization.' }
      });
    }
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createProduct };