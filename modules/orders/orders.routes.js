const express = require('express');
const router = express.Router();
const { createOrder } = require('./orders.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// POST /orders
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  createOrder
);

module.exports = router;