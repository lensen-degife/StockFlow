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

// GET /products
const getProducts = async (req, res) => {
  try {
    const organizationId = req.user.organizationId; 
    
    // Extract query parameters with default values for pagination
    const { search, status, sortBy = 'name', sortOrder = 'ASC', page = 1, limit = 10 } = req.query;
    
    const offset = (page - 1) * limit;
    const queryParams = [organizationId];
    let queryText = 'SELECT id, sku, name, price, status FROM products WHERE organization_id = $1';
    let paramIndex = 2;

    // Search by name
    if (search) {
      queryText += ` AND name ILIKE $${paramIndex}`; // ILIKE is case-insensitive in Postgres
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Sorting (whitelist allowed columns to prevent SQL injection)
    const validSortColumns = ['name', 'price', 'sku'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    queryText += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await db.query(queryText, queryParams);

    res.status(200).json({ 
      success: true, 
      count: result.rows.length,
      page: parseInt(page),
      data: result.rows 
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createProduct, getProducts };