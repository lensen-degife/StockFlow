const express = require('express');
const router = express.Router();
const { createOrder, reserveOrder, confirmOrder, cancelOrder, fulfillOrder, getOrders, getOrderById } = require('./orders.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

const validate = require('../../middleware/validate');
const { createOrderSchema } = require('../../validations/orders.schema');

// GET /orders
router.get(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getOrders
);

// GET /orders/:orderId
router.get(
  '/:orderId', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getOrderById
);

// POST /orders
router.post(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  validate(createOrderSchema), 
  createOrder
);

// POST /orders/:orderId/reserve
router.post(
  '/:orderId/reserve', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  reserveOrder
);

router.post(
  '/:orderId/confirm', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  confirmOrder
);

// POST /orders/:orderId/cancel
router.post(
  '/:orderId/cancel', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  cancelOrder
);

router.post(
  '/:orderId/fulfill', 
  authenticate, 
  requireRole(['org_admin', 'staff']), 
  fulfillOrder
);



module.exports = router;