const express = require('express');
const router = express.Router();
const { createCustomer, getCustomers } = require('./customers.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// POST /customers
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  createCustomer
);

// GET /customers
router.get(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getCustomers
);

module.exports = router;