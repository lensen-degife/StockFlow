const express = require('express');
const router = express.Router();
const { createOrder, reserveOrder } = require('./orders.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// POST /orders
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  createOrder
);

// POST /orders/:orderId/reserve
router.post(
  '/:orderId/reserve', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  reserveOrder
);

module.exports = router;