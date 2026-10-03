const express = require('express');
const router = express.Router();
const { createOrganization } = require('./organizations.controller');
const authenticate = require('../../middleware/authenticate'); 

// The authenticate middleware ensures only logged-in users can create an org
router.post('/', authenticate, createOrganization);

module.exports = router;