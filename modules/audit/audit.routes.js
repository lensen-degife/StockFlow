const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('./audit.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole'); 

// GET /audit-logs
router.get(
  '/', 
  authenticate, 
  requireRole(['org_admin', 'viewer']), 
  getAuditLogs
);

module.exports = router;