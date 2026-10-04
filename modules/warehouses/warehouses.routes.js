const express = require('express');
const router = express.Router();
const { createWarehouse, getWarehouses, getWarehouseById } = require('./warehouses.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// POST /warehouses
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  createWarehouse
);

// GET /warehouses
router.get(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getWarehouses
);

// GET /warehouses/:warehouseId
// We must pass the organization_id in the query string so the middleware knows which org to check
router.get(
  '/:warehouseId', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getWarehouseById
);

module.exports = router;