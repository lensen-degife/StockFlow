const db = require('../../config/db');

// POST /customers
const createCustomer = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const organizationId = req.user.organizationId; // Supplied by middleware

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name and email are required' }
      });
    }

    const result = await db.query(
      'INSERT INTO customers (organization_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, created_at',
      [organizationId, name, email, phone]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Postgres unique constraint violation
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A customer with this email already exists in your organization.' }
      });
    }
    console.error("CREATE CUSTOMER ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /customers
const getCustomers = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    // Fetch customers only for this specific organization
    const result = await db.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE organization_id = $1 ORDER BY name ASC',
      [organizationId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createCustomer, getCustomers };