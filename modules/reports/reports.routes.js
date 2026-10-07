const express = require('express');
const router = express.Router();
const { getLowStockReport } = require('./reports.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

/**
 * @swagger
 * /api/v1/reports/low-stock:
 *   get:
 *     summary: Get low stock alert report
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *         required: true
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A list of low stock items
 */

// GET /reports/low-stock
router.get(
  '/low-stock', 
  authenticate, 
  requireRole(['org_admin']), // Restrict to admins
  getLowStockReport
);

module.exports = router;