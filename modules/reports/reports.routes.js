const express = require('express');
const router = express.Router();
const { getLowStockReport } = require('./reports.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// GET /reports/low-stock
router.get(
  '/low-stock', 
  authenticate, 
  requireRole(['org_admin']), // Restrict to admins
  getLowStockReport
);

module.exports = router;