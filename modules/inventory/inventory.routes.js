const express = require('express');
const router = express.Router();
const { adjustStock, getInventory } = require('./inventory.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// POST /inventory/adjust
router.post(
  '/adjust', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  adjustStock
);

// GET /inventory
router.get(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getInventory
);

module.exports = router;