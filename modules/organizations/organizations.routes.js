const express = require('express');
const router = express.Router();
const { createOrganization, addMember, getOrganization, getMembers  } = require('./organizations.controller');
const authenticate = require('../../middleware/authenticate'); 
const requireRole = require('../../middleware/requireRole');

// The authenticate middleware ensures only logged-in users can create an org
router.post('/', authenticate, createOrganization);

// Use requireRole to ensure only the org_admin can add members
router.post(
  '/:organizationId/members', 
  authenticate, 
  requireRole(['org_admin']), 
  addMember
);

router.get(
  '/:organizationId', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getOrganization
);

router.get(
  '/:organizationId/members', 
  authenticate, 
  requireRole(['org_admin', 'staff', 'viewer']), 
  getMembers
);

module.exports = router;