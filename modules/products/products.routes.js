const express = require('express');
const router = express.Router();
const { createProduct } = require('./products.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// Only admins and staff can create products
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  createProduct
);

module.exports = router;