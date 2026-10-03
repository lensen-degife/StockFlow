

const db = require('../../config/db');

// POST /organizations
const createOrganization = async (req, res) => {
  const { name, slug } = req.body;
  const userId = req.user.userId; // Comes from the authenticate middleware

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name and slug are required' }
    });
  }

  // Get a dedicated connection for the transaction
  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Create the organization
    const orgResult = await client.query(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
      [name, slug]
    );
    const newOrg = orgResult.rows[0];

    // 2. Make the creator the org_admin
    await client.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [newOrg.id, userId, 'org_admin']
    );

    await client.query('COMMIT'); // Save both actions

    res.status(201).json({ success: true, data: newOrg });
  } catch (error) {
    await client.query('ROLLBACK'); // Undo everything if anything failed

    if (error.code === '23505') { // Unique constraint violation (slug exists)
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Organization slug is already taken.' }
      });
    }

    console.error("CREATE ORG ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  } finally {
    client.release(); // Always release the connection back to the pool
  }
};

// POST /organizations/:organizationId/members
const addMember = async (req, res) => {
  try {
    const { email, role } = req.body;
    const { organizationId } = req.params;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and role are required' }
      });
    }

    // Look up the user ID by email
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User with this email not found' }
      });
    }
    const newMemberId = userResult.rows[0].id;

    // Add the user to the organization
    await db.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [organizationId, newMemberId, role]
    );

    res.status(201).json({ success: true, message: 'Member added successfully' });
  } catch (error) {
    if (error.code === '23505') { 
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'User is already a member of this organization.' }
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /organizations/:organizationId
const getOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const result = await db.query(
      'SELECT id, name, slug, created_at FROM organizations WHERE id = $1', 
      [organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Organization not found' }
      });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

// GET /organizations/:organizationId/members
const getMembers = async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // Join the users table to get the names and emails of the members
    const result = await db.query(
      `SELECT u.id, u.name, u.email, om.role, om.created_at 
       FROM organization_members om 
       JOIN users u ON om.user_id = u.id 
       WHERE om.organization_id = $1`,
      [organizationId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  }
};

module.exports = { createOrganization, addMember, getOrganization, getMembers };