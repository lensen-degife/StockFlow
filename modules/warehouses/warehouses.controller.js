const db = require('../../config/db');

// POST /warehouses
const createWarehouse = async (req, res) => {
  try {
    const { name, location } = req.body;
    const organizationId = req.user.organizationId;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Warehouse name is required' }
      });
    }

    const result = await db.query(
      'INSERT INTO warehouses (organization_id, name, location) VALUES ($1, $2, $3) RETURNING id, name, location',
      [organizationId, name, location]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("CREATE WAREHOUSE ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /warehouses
const getWarehouses = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    const result = await db.query(
      'SELECT id, name, location FROM warehouses WHERE organization_id = $1',
      [organizationId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /warehouses/:warehouseId
const getWarehouseById = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const organizationId = req.user.organizationId;
    
    // Multi-tenancy check: Must match BOTH warehouse ID and organization ID
    const result = await db.query(
      'SELECT id, name, location FROM warehouses WHERE id = $1 AND organization_id = $2',
      [warehouseId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Warehouse not found' }
      });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createWarehouse, getWarehouses, getWarehouseById };